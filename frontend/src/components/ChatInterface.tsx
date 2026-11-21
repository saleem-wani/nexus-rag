import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Square,
  Bot,
  User,
  Sparkles,
  FileText,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check
} from 'lucide-react';
import { ChatMessage, CitationSource, SystemSettings } from '../types';
import { CitationViewer } from './CitationViewer';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  streamingMessage: string;
  streamingSources: CitationSource[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onClearChat: () => void;
  selectedDocCount: number;
  totalDocCount: number;
  settings: SystemSettings;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  streamingMessage,
  streamingSources,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onClearChat,
  selectedDocCount,
  totalDocCount,
  settings,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const samplePrompts = [
    "Summarize the main points and conclusions from the documents.",
    "What are the key technical specifications or data mentioned?",
    "Extract actionable recommendations or next steps.",
    "Are there any risks, warnings, or limitations highlighted?"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Top Bar / Scope Info */}
      <div className="h-11 border-b border-slate-850 bg-slate-900/50 px-6 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            {totalDocCount === 0 ? (
              <span className="text-amber-400">No documents indexed yet. Upload files to query.</span>
            ) : selectedDocCount > 0 ? (
              <span>
                Retrieval scoped to <b className="text-white">{selectedDocCount}</b> selected document{selectedDocCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span>
                Retrieving from <b className="text-white">all {totalDocCount}</b> indexed documents
              </span>
            )}
          </span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            Clear thread
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 shadow-lg shadow-indigo-500/10">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">What would you like to know?</h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              Ask questions about your uploaded documents. Responses are grounded directly in your files and verified against pgvector embeddings.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt)}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all text-left group"
                >
                  <span className="text-indigo-400 group-hover:text-indigo-300 font-semibold mr-1.5">
                    →
                  </span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 max-w-4xl mx-auto ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative group rounded-2xl px-5 py-4 max-w-[85%] text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  {/* Markdown or plain text */}
                  {msg.role === 'assistant' ? (
                    <div className="prose-nexus text-xs sm:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Sources / Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <CitationViewer citations={msg.citations} />
                  )}

                  {/* Copy message button */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming Message */}
            {isStreaming && (
              <div className="flex gap-3.5 max-w-4xl mx-auto justify-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-2xl px-5 py-4 max-w-[85%] text-sm bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-none shadow-sm">
                  <div className="prose-nexus text-xs sm:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingMessage}
                    </ReactMarkdown>
                  </div>
                  {/* Flashing cursor */}
                  <span className="inline-block w-2 h-4 bg-indigo-400 ml-1 animate-pulse align-middle" />

                  {/* Streaming Sources */}
                  {streamingSources && streamingSources.length > 0 && (
                    <CitationViewer citations={streamingSources} />
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-slate-900/80 border-t border-slate-800/80">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 shadow-xl transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents... (Shift+Enter for newline)"
              className="w-full bg-transparent text-white placeholder-slate-500 text-sm p-4 pr-24 focus:outline-none resize-none max-h-44"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors flex items-center gap-1 text-xs font-medium"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={`p-2 rounded-xl transition-all ${
                    input.trim()
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
            <span>Powered by PostgreSQL (pgvector) & FastAPI</span>
            <span>RAG Architecture: Cosine Similarity + Strict Context Grounding</span>
          </div>
        </form>
      </div>
    </div>
  );
};

