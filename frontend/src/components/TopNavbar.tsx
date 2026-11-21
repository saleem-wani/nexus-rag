import React from 'react';
import {
  FileText,
  Sliders,
  ChevronDown,
  Sparkles,
  Layers,
  RotateCcw,
  ShieldCheck,
  BarChart3,
  Bug,
  MessageSquare,
} from 'lucide-react';
import { SystemSettings, DocumentItem } from '../types';
import { GeminiSparkle } from './GeminiSparkle';

interface TopNavbarProps {
  currentTitle?: string;
  documentCount: number;
  selectedDocCount: number;
  onOpenDocuments: () => void;
  onOpenSettings: () => void;
  onOpenEvaluation: () => void;
  onClearChat: () => void;
  hasMessages: boolean;
  settings: SystemSettings;
  activeTab: 'chat' | 'debug';
  onChangeTab: (tab: 'chat' | 'debug') => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentTitle,
  documentCount,
  selectedDocCount,
  onOpenDocuments,
  onOpenSettings,
  onOpenEvaluation,
  onClearChat,
  hasMessages,
  settings,
  activeTab,
  onChangeTab,
}) => {
  return (
    <header className="h-16 px-6 bg-[#131314] border-b border-[#282a2c]/60 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Nexus Branding + Model Pill */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <GeminiSparkle size={22} />
          <h1 className="font-heading font-medium text-lg text-[#f0f4f9] tracking-tight">
            NEXUS
          </h1>
        </div>

        {/* Model Selector Pill (Gemini style) */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-[#c4c7c5] hover:text-white bg-[#1e1f20] hover:bg-[#282a2c] border border-[#333537] transition-all"
        >
          <span className="capitalize">{settings.model || '1.5 Flash'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#8e918f]" />
        </button>

        {/* Conversation Title (if active) */}
        {currentTitle && (
          <span className="hidden md:inline-block text-xs text-[#8e918f] truncate max-w-xs pl-2 border-l border-[#282a2c]">
            {currentTitle}
          </span>
        )}
      </div>

      {/* Right: Knowledge Base Scope & Actions */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center rounded-full border border-[#333537] bg-[#1e1f20] p-0.5">
          <button onClick={() => onChangeTab('chat')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${activeTab === 'chat' ? 'bg-[#343638] text-white' : 'text-[#8e918f] hover:text-white'}`}>
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </button>
          <button onClick={() => onChangeTab('debug')} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${activeTab === 'debug' ? 'bg-[#343638] text-white' : 'text-[#8e918f] hover:text-white'}`}>
            <Bug className="h-3.5 w-3.5" /> RAG Debug
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenEvaluation}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#333537] bg-[#1e1f20] px-3 py-1.5 text-xs font-medium text-[#c4c7c5] transition-colors hover:bg-[#282a2c] hover:text-white"
          title="Evaluate RAG quality"
        >
          <BarChart3 className="h-3.5 w-3.5 text-[#8ab4f8]" />
          <span>Evaluate</span>
        </button>
        {/* Document Context Pill */}
        <button
          onClick={onOpenDocuments}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] border border-[#333537] transition-all"
        >
          <FileText className="w-3.5 h-3.5 text-[#4285f4]" />
          <span>
            {documentCount === 0
              ? 'No documents'
              : selectedDocCount > 0
              ? `${selectedDocCount} of ${documentCount} docs`
              : `${documentCount} docs active`}
          </span>
          <ChevronDown className="w-3 h-3 text-[#8e918f]" />
        </button>

        {/* Reset / New Thread */}
        {hasMessages && (
          <button
            onClick={onClearChat}
            className="p-2 rounded-full text-[#8e918f] hover:text-[#f0f4f9] hover:bg-[#282a2c] transition-colors"
            title="Reset thread"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Google User Avatar Circle */}
        <div
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#d96570] p-[1.5px] cursor-pointer shadow-sm hover:scale-105 transition-transform"
          title="Account & Settings"
        >
          <div className="w-full h-full rounded-full bg-[#1e1f20] flex items-center justify-center font-heading font-semibold text-xs text-white">
            N
          </div>
        </div>
      </div>
    </header>
  );
};
