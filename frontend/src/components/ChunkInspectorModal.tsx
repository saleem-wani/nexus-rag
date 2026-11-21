import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Layers, Loader2 } from 'lucide-react';
import { DocumentItem } from '../types';
import { api } from '../api/client';

interface ChunkInspectorModalProps {
  documentId: string | null;
  onClose: () => void;
}

export const ChunkInspectorModal: React.FC<ChunkInspectorModalProps> = ({
  documentId,
  onClose,
}) => {
  const [docDetails, setDocDetails] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!documentId) return;

    let mounted = true;
    setLoading(true);
    api.getDocumentDetails(documentId)
      .then((data) => {
        if (mounted) setDocDetails(data);
      })
      .catch((err) => {
        console.error('Failed to load chunks:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [documentId]);

  if (!documentId) return null;

  const chunks = docDetails?.chunks || [];
  const filteredChunks = chunks.filter((c) =>
    c.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {docDetails?.filename || 'Document Chunks'}
              </h3>
              <p className="text-xs text-slate-400">
                {chunks.length} chunks generated for vector search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-slate-800/60 bg-slate-950/40 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search through chunk contents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <span className="text-xs text-slate-400">
            Showing {filteredChunks.length} of {chunks.length}
          </span>
        </div>

        {/* Chunk list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm">Loading document chunks from pgvector...</p>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              No matching chunks found.
            </div>
          ) : (
            filteredChunks.map((chunk) => (
              <div
                key={chunk.id}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-mono font-semibold">
                      Chunk #{chunk.chunk_index + 1}
                    </span>
                    {chunk.chunk_metadata?.page && (
                      <span className="text-xs text-slate-400">
                        Page {chunk.chunk_metadata.page}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {chunk.content.length} characters
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/40 whitespace-pre-wrap">
                  {chunk.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

