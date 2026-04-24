import { StoredMessage } from '../types';

interface Props {
  messages: StoredMessage[];
  onSelect: (msg: StoredMessage) => void;
  selected: StoredMessage | null;
}

const SEVERITY_COLOR = {
  INFO: 'text-blue-400',
  WARNING: 'text-yellow-400',
  ERROR: 'text-red-400',
};

export function LiveFeed({ messages, onSelect, selected }: Props): JSX.Element {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
        <span className="text-2xl">⏳</span>
        <p>Waiting for webhooks...</p>
        <p className="text-xs">POST to http://localhost:3000/webhooks/payment-created</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: incoming OB webhooks */}
      <div className="w-1/2 flex flex-col border-r border-gray-700">
        <div className="px-3 py-1 text-xs text-gray-400 bg-gray-800 border-b border-gray-700">
          Open Banking Input
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => onSelect(msg)}
              className={`px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${
                selected?.id === msg.id ? 'bg-gray-800 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span
                  className={`text-xs font-bold ${
                    msg.type === 'payment-created' ? 'text-green-400' : 'text-purple-400'
                  }`}
                >
                  {msg.type}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {msg.iso20022Result.mappingWarnings.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {msg.iso20022Result.mappingWarnings.slice(0, 3).map((w, i) => (
                    <span
                      key={i}
                      className={`text-xs ${SEVERITY_COLOR[w.severity]}`}
                    >
                      [{w.severity}]
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: ISO 20022 translation preview */}
      <div className="w-1/2 flex flex-col">
        <div className="px-3 py-1 text-xs text-gray-400 bg-gray-800 border-b border-gray-700">
          ISO 20022 Output
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => onSelect(msg)}
              className={`px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${
                selected?.id === msg.id ? 'bg-gray-800 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-orange-400">
                  {msg.iso20022Result.messageType}
                </span>
                <span className="text-xs text-gray-500 truncate max-w-32" title={msg.iso20022Result.messageId}>
                  {msg.iso20022Result.messageId.slice(0, 8)}…
                </span>
              </div>
              <div className="text-xs text-gray-400 truncate">
                {msg.iso20022Result.xmlDocument.slice(0, 80)}…
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
