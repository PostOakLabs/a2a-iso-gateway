import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { translateOBDomesticPayment, translateOBPaymentStatus } from '../../src/index';
import { OBDomesticPaymentRequest, OBPaymentStatus, ISO20022Result } from '../../src/types';

const app = express();
app.use(express.json());

interface StoredMessage {
  id: string;
  timestamp: string;
  type: 'payment-created' | 'payment-status';
  input: unknown;
  iso20022Result: ISO20022Result;
}

const messages: StoredMessage[] = [];
const clients = new Set<WebSocket>();

function broadcast(data: unknown): void {
  const json = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
}

function storeAndBroadcast(stored: StoredMessage): void {
  messages.push(stored);
  broadcast({ event: 'new-message', data: stored });
}

// POST /webhooks/payment-created
app.post('/webhooks/payment-created', (req: Request, res: Response) => {
  const payment = req.body as OBDomesticPaymentRequest;

  try {
    const iso20022Result = translateOBDomesticPayment(payment);
    const stored: StoredMessage = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'payment-created',
      input: payment,
      iso20022Result,
    };
    storeAndBroadcast(stored);

    // Auto-fire status webhook after 2 seconds
    const paymentId = uuidv4();
    setTimeout(() => {
      const statusPayload: OBPaymentStatus = {
        Data: {
          DomesticPaymentId: paymentId,
          Status: 'AcceptedSettlementCompleted',
          StatusUpdateDateTime: new Date().toISOString(),
          CreationDateTime: new Date().toISOString(),
          Initiation: payment.Data.Initiation,
        },
      };

      try {
        const statusResult = translateOBPaymentStatus(statusPayload, iso20022Result.messageId);
        const statusStored: StoredMessage = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          type: 'payment-status',
          input: statusPayload,
          iso20022Result: statusResult,
        };
        storeAndBroadcast(statusStored);
      } catch (err) {
        console.error('Auto-status translation error:', err);
      }
    }, 2000);

    res.status(200).json({
      paymentId,
      messageId: iso20022Result.messageId,
      warnings: iso20022Result.mappingWarnings,
    });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// POST /webhooks/payment-status
app.post('/webhooks/payment-status', (req: Request, res: Response) => {
  const { status, originalMessageId } = req.body as {
    status: OBPaymentStatus;
    originalMessageId: string;
  };

  try {
    const iso20022Result = translateOBPaymentStatus(status, originalMessageId || uuidv4());
    const stored: StoredMessage = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'payment-status',
      input: status,
      iso20022Result,
    };
    storeAndBroadcast(stored);
    res.status(200).json({ messageId: iso20022Result.messageId });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /payments/:id
app.get('/payments/:id', (req: Request, res: Response) => {
  const msg = messages.find((m) => m.id === req.params.id);
  if (!msg) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }
  res.json(msg);
});

// GET /payments
app.get('/payments', (_req: Request, res: Response) => {
  res.json({ count: messages.length, payments: messages });
});

// POST /reset
app.post('/reset', (_req: Request, res: Response) => {
  messages.length = 0;
  broadcast({ event: 'reset' });
  res.json({ ok: true });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', messageCount: messages.length });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  // Send existing messages to new connections
  ws.send(JSON.stringify({ event: 'init', data: messages }));
  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.warn(`a2a-iso-gateway mock server running on http://localhost:${PORT}`);
  console.warn(`WebSocket endpoint: ws://localhost:${PORT}`);
});

export { app, server };
