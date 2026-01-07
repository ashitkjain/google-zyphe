import React, { useState, useEffect } from 'react';
import { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
}

const DebugPromptBox: React.FC<Props> = ({ logs }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  // Filter for the most recent request that looks like a prompt string
  useEffect(() => {
    const promptLogs = logs.filter(l => l.type === 'request' && (typeof l.content === 'string' || l.content?.promptText));
    if (promptLogs.length > 0) {
      const latest = promptLogs[promptLogs.length - 1];
      setLastPrompt(typeof latest.content === 'string' ? latest.content : latest.content.promptText);
    }
  }, [logs]);

  if (!lastPrompt && !isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isVisible ? (
        <div className="w-[350px] md:w-[500px] h-[400px] bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                <i className="fa-solid fa-bug-slash text-indigo-400 text-xs"></i>
              </div>
              <span className="text-xs font-black text-white uppercase tracking-widest">AI Prompt Debugger</span>
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed text-indigo-300/90 bg-[#0B0F1A] no-scrollbar">
            <div className="mb-4 text-gray-500 flex items-center justify-between">
              <span className="uppercase tracking-widest text-[9px] font-black">Latest Payload</span>
              <button 
                onClick={() => navigator.clipboard.writeText(lastPrompt || '')}
                className="hover:text-white transition-colors flex items-center gap-1.5"
              >
                <i className="fa-solid fa-copy"></i>
                COPY
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words italic">
              {lastPrompt || "No prompt data captured yet..."}
            </pre>
          </div>

          <div className="px-6 py-3 bg-gray-800/30 border-t border-gray-800 flex items-center justify-between">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Zyphe™ Debug v1.0</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsVisible(true)}
          className="bg-gray-900 text-indigo-400 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl border border-gray-800 hover:bg-gray-800 hover:scale-105 transition-all active:scale-95 group"
          title="Show Prompt Debugger"
        >
          <i className="fa-solid fa-bug group-hover:animate-bounce"></i>
          {lastPrompt && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-gray-900 flex animate-pulse"></span>
          )}
        </button>
      )}
    </div>
  );
};

export default DebugPromptBox;