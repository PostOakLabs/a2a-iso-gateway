import { useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { LiveFeed } from './components/LiveFeed';
import { MessageDetail } from './components/MessageDetail';
import { StoredMessage } from './types';

type Tab = 'feed' | 'detail';

const WS_URL = `ws://${window.location.hostname}:3000`;

export default function App(): JSX.Element {
  const { connected, messages, reset } = useWebSocket(WS_URL);
  const [selected, setSelected] = useState<StoredMessage | null>(null);
  const [tab, setTab] = useState<Tab>('feed');

  function handleSelect(msg: StoredMessage): void {
    setSelected(msg);
    setTab('detail');
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-blue-400">a2a-iso-gateway</span>
          <span className="text-xs text-gray-500">Message Inspector</span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`flex items-center gap-1 text-xs ${
              connected ? 'text-green-400' : 'text-red-400'
            }`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-xs text-gray-500">{messages.length} messages</span>
          <button
            onClick={reset}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 px-4 py-1 bg-gray-900 border-b border-gray-700">
        {(['feed', 'detail'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-xs rounded-t ${
              tab === t
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'feed' ? 'Live Feed' : 'Message Detail'}
          </button>
        ))}
      </nav>

      {/* Body */}
      <main className="flex-1 overflow-hidden">
        {tab === 'feed' && (
          <LiveFeed messages={messages} onSelect={handleSelect} selected={selected} />
        )}
        {tab === 'detail' && selected && <MessageDetail message={selected} />}
        {tab === 'detail' && !selected && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a message from the Live Feed
          </div>
        )}
      </main>
    </div>
  );
}
