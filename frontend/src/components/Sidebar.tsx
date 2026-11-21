import React from 'react';
import {
  Menu,
  Plus,
  MessageSquare,
  Trash2,
  FileText,
  Settings as SettingsIcon,
  Database,
  Upload,
  CheckCircle2,
  Clock,
  MoreVertical,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Conversation, DocumentItem, SystemSettings } from '../types';
import { GeminiSparkle } from './GeminiSparkle';

interface SidebarProps {
  conversations: Conversation[];
  currentConvId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  documents: DocumentItem[];
  selectedDocIds: string[];
  onToggleSelectDoc: (id: string) => void;
  onOpenDocuments: () => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  systemHealth: { status: string; pgvector: string } | null;
  settings: SystemSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  currentConvId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  documents,
  selectedDocIds,
  onToggleSelectDoc,
  onOpenDocuments,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
  systemHealth,
  settings,
}) => {
  const isHealthy = systemHealth?.status === 'healthy';

  return (
    <aside
      className={`h-full flex flex-col bg-[#1e1f20] transition-all duration-300 z-30 select-none border-r border-[#282a2c]/60 ${
        isCollapsed ? 'w-[68px]' : 'w-72 xl:w-80'
      }`}
    >
      {/* Top Header: Hamburger Button */}
      <div className="h-16 px-4 flex items-center justify-between">
        <button
          onClick={onToggleCollapse}
          className="p-2.5 rounded-full text-[#c4c7c5] hover:text-[#f0f4f9] hover:bg-[#282a2c] transition-colors"
          title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <Menu className="w-5 h-5" />
        </button>

        {!isCollapsed && (
          <div className="flex items-center gap-2 pr-2">
            <GeminiSparkle size={20} />
            <span className="font-heading font-medium text-base text-[#f0f4f9] tracking-tight">
              NEXUS
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#282a2c] text-[#c4c7c5] border border-[#37393b]">
              RAG
            </span>
          </div>
        )}
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-2">
        <button
          onClick={onNewConversation}
          className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium text-[#e3e3e3] hover:text-white bg-[#131314] hover:bg-[#282a2c] border border-[#333537] shadow-sm transition-all active:scale-[0.98] ${
            isCollapsed ? 'w-10 h-10 p-0 justify-center rounded-full mx-auto' : 'w-full'
          }`}
          title="New chat"
        >
          <Plus className="w-4 h-4 text-[#4285f4]" />
          {!isCollapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Scrollable Center: Recent Chats & Documents */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {/* Recent Chat Threads */}
        <div>
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-xs font-medium text-[#8e918f]">
              Recent
            </div>
          )}

          <div className="space-y-0.5">
            {conversations.length === 0 ? (
              !isCollapsed && (
                <div className="px-3 py-3 text-xs text-[#8e918f]">
                  No recent chats
                </div>
              )
            ) : (
              conversations.map((conv) => {
                const isActive = currentConvId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-full text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#282a2c] text-[#f0f4f9] font-medium'
                        : 'text-[#c4c7c5] hover:bg-[#282a2c]/60 hover:text-[#f0f4f9]'
                    }`}
                    title={conv.title}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#4285f4]' : 'text-[#8e918f]'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate max-w-[170px]">{conv.title || 'New Chat'}</span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-full text-[#8e918f] hover:text-[#f28b82] hover:bg-[#333537] transition-all"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Knowledge Base / Documents Section */}
        {!isCollapsed && (
          <div className="pt-2 border-t border-[#282a2c]">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-xs font-medium text-[#8e918f]">
                Documents ({documents.length})
              </span>
              <button
                onClick={onOpenDocuments}
                className="text-xs text-[#4285f4] hover:underline font-medium"
              >
                Manage
              </button>
            </div>

            <div className="space-y-1 mt-1 max-h-48 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <div
                  onClick={onOpenDocuments}
                  className="px-3 py-2.5 rounded-xl border border-dashed border-[#333537] hover:border-[#4285f4]/50 bg-[#131314]/40 text-center cursor-pointer transition-colors"
                >
                  <p className="text-xs text-[#8e918f]">+ Upload docs for Nexus</p>
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => onToggleSelectDoc(doc.id)}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#282a2c] text-[#f0f4f9]'
                          : 'text-[#c4c7c5] hover:bg-[#282a2c]/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-[#4285f4] shrink-0" />
                        <span className="truncate max-w-[155px]" title={doc.filename}>
                          {doc.filename}
                        </span>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          doc.status === 'COMPLETED'
                            ? 'bg-[#81c995]'
                            : 'bg-[#fdd663] animate-pulse'
                        }`}
                        title={doc.status}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Profile / System Controls */}
      <div className="p-3 border-t border-[#282a2c] bg-[#1a1b1c] space-y-1.5">
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 py-1 text-xs text-[#8e918f]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-[#81c995]' : 'bg-[#fdd663]'}`} />
              <span className="font-mono text-[11px]">pgvector: 384d</span>
            </div>
            <span className="capitalize text-[11px] font-medium text-[#c4c7c5]">
              {settings.llmProvider}
            </span>
          </div>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-3 px-3 py-2 rounded-full text-xs font-medium text-[#c4c7c5] hover:text-[#f0f4f9] hover:bg-[#282a2c] transition-colors ${
            isCollapsed ? 'justify-center p-2 rounded-full mx-auto w-10 h-10' : 'w-full'
          }`}
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4 text-[#8e918f]" />
          {!isCollapsed && <span>Settings & Models</span>}
        </button>
      </div>
    </aside>
  );
};
