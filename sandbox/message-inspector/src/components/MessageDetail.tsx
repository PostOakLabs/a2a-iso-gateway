import Editor from '@monaco-editor/react';
import { StoredMessage, MappingWarning } from '../types';

interface Props {
  message: StoredMessage;
}

const SEVERITY_BG = {
  INFO: 'bg-blue-900 text-blue-200',
  WARNING: 'bg-yellow-900 text-yellow-200',
  ERROR: 'bg-red-900 text-red-200',
};

function WarningRow({ w }: { w: MappingWarning }): JSX.Element {
  return (
    <div className={`flex gap-2 px-3 py-1 rounded text-xs ${SEVERITY_BG[w.severity]}`}>
      <span className="font-bold shrink-0">[{w.severity}]</span>
      <span className="font-medium shrink-0">{w.field}</span>
      <span className="text-gray-300">{w.message}</span>
      {w.isoPath && (
        <span className="ml-auto shrink-0 text-gray-400 font-mono">{w.isoPath}</span>
      )}
    </div>
  );
}

export function MessageDetail({ message }: Props): JSX.Element {
  const inputJson = JSON.stringify(message.input, null, 2);
  const { iso20022Result } = message;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-700 text-xs">
        <span className="text-orange-400 font-bold">{iso20022Result.messageType}</span>
        <span className="text-gray-400 font-mono">{iso20022Result.messageId}</span>
        <span className="text-gray-500">{iso20022Result.creationDateTime}</span>
        {iso20022Result.tokenizationInstruction && (
          <span className="ml-auto text-purple-400">+ TokenizationInstruction</span>
        )}
      </div>

      {/* Editors side by side */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-gray-700">
          <div className="px-3 py-1 text-xs text-gray-400 bg-gray-800">JSON Input</div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={inputJson}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12 }}
              theme="vs-dark"
            />
          </div>
        </div>
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1 text-xs text-gray-400 bg-gray-800">ISO 20022 XML</div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="xml"
              value={iso20022Result.xmlDocument}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12 }}
              theme="vs-dark"
            />
          </div>
        </div>
      </div>

      {/* Mapping warnings */}
      {iso20022Result.mappingWarnings.length > 0 && (
        <div className="border-t border-gray-700 max-h-40 overflow-y-auto">
          <div className="px-3 py-1 text-xs text-gray-400 bg-gray-800 border-b border-gray-700">
            Mapping Warnings ({iso20022Result.mappingWarnings.length})
          </div>
          <div className="flex flex-col gap-1 p-2">
            {iso20022Result.mappingWarnings.map((w, i) => (
              <WarningRow key={i} w={w} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
