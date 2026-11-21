import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Square,
  Plus,
  Paperclip,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  RotateCcw,
  Compass,
  FileText,
  BarChart3,
  ShieldCheck,
  Zap,
  Mic,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { ChatMessage, CitationSource, SystemSettings } from '../types';
import { GeminiSparkle } from './GeminiSparkle';
import { CitationCards } from './CitationCards';

interface ChatViewProps {
  messages: ChatMessage[];
  streamingMessage: string;
  streamingSources: CitationSource[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onSelectCitation: (citation: CitationSource) => void;
  onOpenDocuments: () => void;
  selectedDocCount: number;
  totalDocCount: number;
  settings: SystemSettings;
}

const isGreetingReply = (previousMessage?: ChatMessage): boolean => {
  if (!previousMessage || previousMessage.role !== 'user') return false;
  const normalized = previousMessage.content.toLowerCase().replace(/[^a-z\s']/g, '').trim();
  return /^(h+i+|hello+|hey+|yo+|good morning|good afternoon|good evening|how are you(?: doing)?)(?: there| again)?$/.test(normalized);
};

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  streamingMessage,
  streamingSources,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onSelectCitation,
  onOpenDocuments,
  selectedDocCount,
  totalDocCount,
  settings,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const toggleLike = (id: string, isLike: boolean) => {
    setLikedMap((prev) => ({
      ...prev,
      [id]: prev[id] === isLike ? undefined as any : isLike,
    }));
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const starterCards = [
    {
      title: "Executive Summary",
      desc: "Summarize the key points, objectives, and conclusions across all files",
      prompt: "Provide a detailed executive summary of the uploaded documents.",
      icon: <Compass className="w-5 h-5 text-[#4285f4]" />,
    },
    {
      title: "Metrics & Data Extraction",
      desc: "Extract financial figures, percentages, and metrics into a clear markdown table",
      prompt: "Extract all numbers, percentages, and key metrics from the documents into a formatted markdown table.",
      icon: <BarChart3 className="w-5 h-5 text-[#81c995]" />,
    },
    {
      title: "Compliance & Policy Audit",
      desc: "What are the rules, eligibility criteria, and operational policies?",
      prompt: "What are the key rules, policies, and requirements outlined in the documents?",
      icon: <ShieldCheck className="w-5 h-5 text-[#d96570]" />,
    },
    {
      title: "Action Items & Next Steps",
      desc: "Compile actionable recommendations, deadlines, and deliverables",
      prompt: "Identify the critical action items, next steps, and potential risks mentioned in the text.",
      icon: <Zap className="w-5 h-5 text-[#fdd663]" />,
    },
  ];

  return (
    <div className="relative flex-1 flex flex-col h-full bg-[#131314] overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-8 space-y-8">
        {messages.length === 0 && !isStreaming ? (
          /* Gemini Authentic Greeting Hero */
          <div className="h-full flex flex-col justify-center max-w-3xl mx-auto py-8">
            <div className="mb-2">
              <span className="gemini-gradient-text text-4xl sm:text-5xl md:text-6xl font-heading font-medium tracking-tight">
                Hello, explorer
              </span>
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-heading font-medium text-[#c4c7c5] tracking-tight mb-10">
              How can I help with your documents today?
            </div>

            {totalDocCount === 0 && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#4285f4]/25 bg-[#4285f4]/[0.06] p-4">
                <div>
                  <p className="text-sm font-medium text-[#f0f4f9]">Start by adding a document</p>
                  <p className="text-xs text-[#8e918f] mt-1">Upload a PDF, Word file, Markdown, CSV, or text file to ask grounded questions.</p>
                </div>
                <button type="button" onClick={onOpenDocuments} className="shrink-0 rounded-full bg-[#1a73e8] px-4 py-2 text-xs font-medium text-white hover:bg-[#1b66ca]">Add documents</button>
              </div>
            )}

            {/* Gemini Prompt Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {starterCards.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSendMessage(card.prompt)}
                  className="group relative p-4 rounded-2xl bg-[#1e1f20] hover:bg-[#282a2c] cursor-pointer transition-all duration-200 border border-transparent hover:border-[#37393b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285f4] flex flex-col justify-between h-44 text-left"
                >
                  <p className="text-xs text-[#e3e3e3] group-hover:text-white font-medium leading-relaxed">
                    {card.desc}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4">
                    <span className="text-[11px] font-medium text-[#8e918f] group-hover:text-[#c4c7c5]">
                      {card.title}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-[#131314] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      {card.icon}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Thread */
          <div className="max-w-3xl xl:max-w-4xl mx-auto space-y-8">
            {messages.map((msg, messageIndex) => (
              <div key={msg.id} className="space-y-4">
                {/* User Message */}
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-[24px] bg-[#282a2c] text-[#f0f4f9] px-5 py-3.5 text-sm leading-relaxed shadow-sm">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  /* Assistant Message (Gemini style: sits organically on canvas) */
                  <div className="flex gap-4 items-start">
                    {/* Gemini Sparkle Icon */}
                    <div className="shrink-0 mt-1">
                      <GeminiSparkle size={24} />
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Markdown Body */}
                      <div className="prose-gemini">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Source Document Name at the end after the response */}
                      {msg.citations && msg.citations.length > 0 && !isGreetingReply(messages[messageIndex - 1]) && (
                        <CitationCards
                          citations={msg.citations}
                          onSelectCitation={onSelectCitation}
                        />
                      )}
                      {msg.citations?.length === 0 && msg.role === 'assistant' && !isGreetingReply(messages[messageIndex - 1]) && (
                        <p className="text-xs text-[#8e918f]">No document excerpts were used for this response.</p>
                      )}

                      {/* Action Bar (Thumbs, Copy, Share) */}
                      <div className="flex items-center gap-1 pt-2 text-[#8e918f]">
                        <button
                          onClick={() => toggleLike(msg.id, true)}
                          className={`p-1.5 rounded-full hover:bg-[#282a2c] transition-colors ${
                            likedMap[msg.id] === true ? 'text-[#81c995] bg-[#282a2c]' : 'hover:text-[#f0f4f9]'
                          }`}
                          title="Good response"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleLike(msg.id, false)}
                          className={`p-1.5 rounded-full hover:bg-[#282a2c] transition-colors ${
                            likedMap[msg.id] === false ? 'text-[#f28b82] bg-[#282a2c]' : 'hover:text-[#f0f4f9]'
                          }`}
                          title="Bad response"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1.5 rounded-full hover:bg-[#282a2c] hover:text-[#f0f4f9] transition-colors ml-1"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-4 h-4 text-[#81c995]" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live Streaming Assistant Message */}
            {isStreaming && (
              <div className="flex gap-4 items-start">
                <div className="shrink-0 mt-1 animate-pulse">
                  <GeminiSparkle size={24} />
                </div>

                <div className="flex-1 space-y-2 min-w-0">
                  <div className="prose-gemini">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingMessage}
                    </ReactMarkdown>
                    {/* Gemini Glowing Cursor */}
                    <span className="inline-block w-2 h-4 bg-[#4285f4] ml-1 animate-pulse align-middle" />
                  </div>

                  {/* Source Document Name at the end after the response */}
                  {streamingSources && streamingSources.length > 0 && (
                    <CitationCards
                      citations={streamingSources}
                      onSelectCitation={onSelectCitation}
                    />
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Gemini Signature Floating Input Capsule */}
      <div className="px-4 sm:px-8 pb-4 pt-2 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent z-20">
        <form onSubmit={handleSubmit} className="max-w-3xl xl:max-w-4xl mx-auto">
          {/* Active Document Attached Scope Pill */}
          {totalDocCount > 0 && (
            <div className="flex items-center justify-between text-xs text-[#8e918f] px-4 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#4285f4]" />
                <span>
                  {selectedDocCount > 0
                    ? `Scoped to ${selectedDocCount} selected document${selectedDocCount > 1 ? 's' : ''}`
                    : `Active across all ${totalDocCount} documents in knowledge base`}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenDocuments}
                className="text-[#4285f4] hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* The Gemini Capsule */}
          <div className="relative rounded-[28px] bg-[#1e1f20] hover:bg-[#282a2c]/80 border border-[#37393b] hover:border-[#444746] transition-all gemini-border-glow shadow-lg p-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nexus about your documents..."
              className="w-full bg-transparent text-[#f0f4f9] placeholder-[#8e918f] text-sm px-4 pt-2 pb-1 focus:outline-none resize-none max-h-40 leading-relaxed font-sans"
            />

            {/* Bottom Capsule Toolbar */}
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-1.5">
                {/* Upload / Attach Button */}
                <button
                  type="button"
                  onClick={onOpenDocuments}
                  className="p-2 rounded-full text-[#c4c7c5] hover:text-[#f0f4f9] hover:bg-[#333537] transition-colors"
                  title="Attach or upload documents"
                >
                  <Plus className="w-5 h-5 text-[#8e918f] hover:text-white" />
                </button>

                <button
                  type="button"
                  onClick={onOpenDocuments}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs text-[#c4c7c5] hover:text-white hover:bg-[#333537] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#4285f4]" />
                  <span>Docs</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopStreaming}
                    className="p-2.5 rounded-full bg-[#f28b82]/20 hover:bg-[#f28b82]/30 text-[#f28b82] transition-colors"
                    title="Stop generating"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={`p-2.5 rounded-full transition-all ${
                      input.trim()
                        ? 'bg-[#1a73e8] text-white hover:bg-[#1b66ca] shadow-md'
                        : 'text-[#5f6368] cursor-not-allowed'
                    }`}
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nexus Disclaimer */}
          <p className="text-center text-[11px] text-[#8e918f] mt-2.5">
            Nexus may display inaccurate info, so double-check its responses. Grounded in PostgreSQL pgvector.
          </p>
        </form>
      </div>
    </div>
  );
};
