import React, { useState, useRef, useEffect } from 'react';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from '../types';
import { CHAT_MODEL, getAi } from '../services/geminiService';
import { APP_CONFIG } from '../config';
import { getChatInstruction, getChatContext } from '../prompts/property/chatInterface';
import { logLLMCall, updateLLMCall } from '../services/firebase/llm_logs';
import { serverTimestamp } from 'firebase/firestore';
import { urlToBase64 } from '../services/geminiService';

interface Props {
  property: PropertyData;
  visual: CustomAIAnalysisResult | null;
  comprehensive: ComprehensiveAnalysisResult | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatInterface: React.FC<Props> = ({ property, visual, comprehensive }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `Hello! I'm Zyphe, your property concierge. I've analyzed this property at ${property.address}. What specific details can I help you with today?` }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (text: string = input) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    let logId: string | null = null;
    try {
      const ai = getAi();

      // Construct intelligence context to be sent with the system instruction
      // This ensures the model is always aware of the property without needing the full chat history
      const intelligenceContext = getChatContext(property, visual, comprehensive);

      const systemInstruction = getChatInstruction(intelligenceContext);

      // Log the outgoing request
      logId = await logLLMCall({
        user_id: "unknown", // Fallback to pick up real UID or 'unknown'
        zpid: property.zpid,
        prompt_filename: "ChatInterface.tsx",
        llm_name: CHAT_MODEL,
        raw_payload: { prompt: text, context: intelligenceContext },
        raw_response: null,
        status: 'pending',
        request_sent_at: serverTimestamp()
      });

      // Perform a stateless content generation request
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: text,
        config: {
          systemInstruction,
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          thinkingConfig: { thinkingBudget: 0 }
        },
      });

      const aiText = response.text || "I apologize, I'm having trouble processing that request right now.";

      let finalContent = aiText;

      // Handle the routing JSON if data is missing
      try {
        const routingResult = JSON.parse(aiText);
        if (routingResult.routing === "MISSING") {
          if (routingResult.source === "images" && visual?.image_by_image_analysis) {
            // Step 2: Resubmit with images found by token/id
            // Map routingResult.image_indices (indices) back to the actual IDs in the cached analysis
            const targetImageIds = routingResult.image_indices
              .map((idx: number) => visual.image_by_image_analysis?.[idx]?.image_id)
              .filter(Boolean);

            if (targetImageIds.length > 0) {
              const imageParts = await Promise.all(targetImageIds.map((url: string) => urlToBase64(url)));
              const messageWithImages = {
                role: 'user',
                parts: [
                  { text: `The following information was requested: "${text}". I have provided some relevant property photos. Please answer based on these photos.` },
                  ...imageParts.map(img => ({ inlineData: img }))
                ]
              };

              const imgResponse = await ai.models.generateContent({
                model: CHAT_MODEL,
                contents: messageWithImages as any,
                config: {
                  systemInstruction,
                  temperature: 0.1
                }
              });
              finalContent = imgResponse.text || "I've checked the photos but still couldn't find a definitive answer.";
            } else {
              finalContent = "I'm sorry, I don't have the specific details and there are no relevant photos to check.";
            }
          } else if (routingResult.source === "search") {
            // Step 2: Resubmit with Search Grounding
            const searchResponse = await ai.models.generateContent({
              model: CHAT_MODEL,
              contents: text,
              config: {
                systemInstruction,
                tools: [{ googleSearch: {} }] as any,
                temperature: 0.1
              }
            });
            finalContent = searchResponse.text || "I searched for the information but couldn't find a reliable answer.";
          } else {
            finalContent = "I'm sorry, I don't have specific data for that request in my records yet. I can help with details on the property specifications, financials, or the neighborhood data I have available.";
          }
        } else {
          // AI returned JSON that wasn't a "MISSING" route - likely a hallucination
          finalContent = "I'm sorry, I'm having a bit of trouble retrieving that specific data right now. Could you try rephrasing your question about the property's features, neighborhood, or market data?";
        }
      } catch (e) {
        // Not JSON, treat as normal response
      }

      // Update the log with the FINAL response and usage
      if (logId) {
        updateLLMCall(logId, {
          raw_response: finalContent, // Log the final answer, not the routing JSON
          status: 'completed',
          response_received_at: serverTimestamp(),
          usage_metadata: (response.usageMetadata as any) || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
        }).catch(err => console.error("Failed to update chat log:", err));
      }

      setMessages(prev => [...prev, { role: 'assistant', content: finalContent }]);
    } catch (err: any) {
      console.error("Chat Error:", err);

      // Log the error in Firestore for production debugging
      if (logId) {
        updateLLMCall(logId, {
          raw_response: err.message,
          status: 'failed',
          error: err.stack || err.message,
          response_received_at: serverTimestamp()
        }).catch(e => console.error("Failed to update chat error log:", e));
      }

      setMessages(prev => [...prev, { role: 'assistant', content: "I've encountered a connection error. Please try asking your question again." }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    { label: "Is This A Good Investment?", icon: "fa-chart-line" },
    { label: "Safety And Community Vibe?", icon: "fa-shield-halved" },
    { label: "Technical Specs & Condition", icon: "fa-gears" },
    { label: "Walk & Transit Scores?", icon: "fa-route" }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-[80] flex flex-col items-end">
      {isOpen && (
        <div className="w-[380px] md:w-[450px] h-[600px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300 mb-4 ring-1 ring-slate-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-700 to-gray-900 p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <i className="fa-solid fa-comments text-white text-sm"></i>
              </div>
              <div>
                <h3 className="text-white font-black text-sm tracking-tight">Property Concierge</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">AI Intelligence Active</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'bg-white border border-slate-100 text-slate-700 shadow-sm'
                  }`}>
                  {m.content.split('\n').map((line, idx) => (
                    <p key={idx} className={idx > 0 ? 'mt-2' : ''}>
                      {line.split(/(\*\*.*?\*\*)/).map((part, pidx) => (
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={pidx} className="font-bold">{part.slice(2, -2)}</strong>
                          : part
                      ))}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 px-5 py-3.5 rounded-2xl flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Context Indicators / Suggestions */}
          <div className="px-6 py-4 bg-white border-t border-slate-100">
            <div className="flex overflow-x-auto gap-2 pb-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(s.label)}
                  className="flex-shrink-0 px-4 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-[10px] font-black tracking-tight text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-2"
                >
                  <i className={`fa-solid ${s.icon} text-[10px]`}></i>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-slate-100">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">Zyphe Concierge</span>
              </div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">v2.4 Intelligence</span>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the concierge anything..."
                className="w-full pl-5 pr-14 py-4 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none text-sm font-medium transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                <i className="fa-solid fa-paper-plane-top"></i>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Button Container */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 bg-gradient-to-r from-indigo-700 to-gray-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group relative border border-white/20"
        >
          <i className={`fa-solid ${isOpen ? 'fa-chevron-down' : 'fa-comments'} text-xl`}></i>
          {!isOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-slate-50 rounded-full animate-pulse"></span>
          )}
        </button>

        {/* Help Labels */}
        <div className="mt-3 flex flex-col items-end px-1">
          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Concierge</span>
          <span className="text-[9px] font-bold text-slate-400">Ask me any question</span>
        </div>
      </div>

    </div>
  );
};

export default ChatInterface;
