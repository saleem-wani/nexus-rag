import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, ExternalLink, Bookmark } from 'lucide-react';
import { CitationSource } from '../types';

interface CitationViewerProps {
  citations: CitationSource[];
}

export const CitationViewer: React.FC<CitationViewerProps> = ({ citations }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
        Retrieved Document Sources ({citations.length})
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {citations.map((src, idx) => {
          const isExpanded = expandedIndex === idx;
          const scorePercent = Math.round((src.similarity_score || 0) * 100);

          return (
            <div
              key={`${src.document_id}-${src.chunk_index}-${idx}`}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-lg p-2.5 text-xs transition-all"
            >
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-medium text-slate-200 truncate" title={src.filename}>
                    {src.filename}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                      scorePercent > 70
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}
                  >
                    {scorePercent}% match
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Metadata row */}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                <span>Chunk #{src.chunk_index + 1}</span>
                {src.metadata?.page && (
                  <span>• Page {src.metadata.page}</span>
                )}
                {src.metadata?.char_count && (
                  <span>• {src.metadata.char_count} chars</span>
                )}
              </div>

              {/* Expandable Excerpt Content */}
              {isExpanded && (
                <div className="mt-2.5 pt-2 border-t border-slate-800 text-slate-300 font-mono text-[11px] leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/60 max-h-48 overflow-y-auto">
                  <p className="whitespace-pre-wrap">{src.content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

