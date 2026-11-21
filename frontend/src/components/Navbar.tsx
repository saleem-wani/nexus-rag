import React from 'react';
import { Database, Settings as SettingsIcon, Cpu, CheckCircle2, AlertCircle, FileText, MessageSquare } from 'lucide-react';
import { SystemSettings } from '../types';

interface NavbarProps {
  onOpenSettings: () => void;
  systemHealth: { status: string; pgvector: string } | null;
  settings: SystemSettings;
  activeTab: 'chat' | 'documents';
  onTabChange: (tab: 'chat' | 'documents') => void;
  documentCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  systemHealth,
  settings,
  activeTab,
  onTabChange,
  documentCount,
}) => {
  const isHealthy = systemHealth?.status === 'healthy';

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">Nexus RAG</h1>
              <span className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                pgvector
              </span>
            </div>
            <p className="text-xs text-slate-400">Postgres + FastAPI + React AI Engine</p>
          </div>
        </div>

        {/* Tab switch for mobile/compact views */}
        <div className="hidden sm:flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
          <button
            onClick={() => onTabChange('chat')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all font-medium ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat & Q&A
          </button>
          <button
            onClick={() => onTabChange('documents')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all font-medium ${
              activeTab === 'documents'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Documents
            <span className="ml-1 bg-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {documentCount}
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-xs">
          {isHealthy ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">pgvector Connected</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Connecting DB...</span>
            </>
          )}
        </div>

        {/* Active Provider Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span className="capitalize">{settings.llmProvider}</span>
          <span className="text-slate-500 font-mono text-[11px]">({settings.model})</span>
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
          title="RAG & LLM Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

