import React, { useState } from 'react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

const SystemLogs: React.FC<Props> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div className="mt-14 border-t border-gray-200 pt-10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 text-gray-500 hover:text-indigo-600 transition-colors mb-5 group"
      >
        <div className={`p-2 rounded-lg bg-gray-100 group-hover:bg-indigo-100 transition-colors`}>
          <i className={`fa-solid fa-terminal text-sm`}></i>
        </div>
        <span className="text-base font-bold uppercase tracking-widest">System Logs ({logs.length})</span>
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-xs`}></i>
      </button>

      {isOpen && (
        <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl font-mono text-xs leading-relaxed">
          <div className="bg-gray-800 px-5 py-3 border-b border-gray-700 flex items-center justify-between">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <span className="text-gray-400 text-xs font-bold">prop-intel-terminal — v1.0.4</span>
          </div>
          <div className="p-5 max-h-[600px] overflow-y-auto space-y-5 no-scrollbar">
            {logs.map((log, idx) => (
              <div key={idx} className="border-l-2 border-gray-700 pl-4 py-1.5">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-gray-500">[{log.timestamp}]</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    log.type === 'request' ? 'bg-blue-900/40 text-blue-400' :
                    log.type === 'response' ? 'bg-green-900/40 text-green-400' :
                    log.type === 'info' ? 'bg-indigo-900/40 text-indigo-400' :
                    'bg-red-900/40 text-red-400'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-indigo-400 font-bold">{log.service}</span>
                </div>
                <pre className="text-gray-300 whitespace-pre-wrap break-all overflow-x-auto text-[11px]">
                  {typeof log.content === 'string' 
                    ? log.content 
                    : JSON.stringify(log.content, null, 2)}
                </pre>
              </div>
            ))}
            <div className="flex items-center text-gray-500 animate-pulse">
              <span className="mr-2">_</span>
              <span className="text-xs">Waiting for system events...</span>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .no-scrollbar::-webkit-scrollbar-track {
          background: #111827;
        }
        .no-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 4px;
        }
        .no-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
};

export default SystemLogs;