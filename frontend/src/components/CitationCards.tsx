import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { CitationSource } from '../types';

interface CitationCardsProps {
  citations: CitationSource[];
  onSelectCitation?: (citation: CitationSource) => void;
}

export const CitationCards: React.FC<CitationCardsProps> = ({
  citations,
  onSelectCitation,
}) => {
  if (!citations || citations.length === 0) return null;

  // Show one source per document, using its strongest retrieved excerpt as the detail view.
  const bestSourceByDocument = new Map<string, CitationSource>();
  for (const source of citations) {
    const key = source.document_id || source.filename;
    const current = bestSourceByDocument.get(key);
    if (!current || (source.similarity_score || 0) > (current.similarity_score || 0)) {
      bestSourceByDocument.set(key, source);
    }
  }
  const uniqueSources = Array.from(bestSourceByDocument.values());

  return (
    <div className="mt-3 pt-3 border-t border-[#282a2c]/60 flex flex-wrap items-center gap-2 text-xs text-[#8e918f]">
      <span className="text-[11px] font-medium text-[#8e918f]">
        {uniqueSources.length > 1 ? 'Sources:' : 'Source:'}
      </span>

      <div className="flex flex-wrap gap-1.5">
        {uniqueSources.map((doc) => (
          <button
            key={`${doc.document_id}:${doc.chunk_index}`}
            type="button"
            onClick={() => onSelectCitation && onSelectCitation(doc)}
            className="group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#1e1f20] hover:bg-[#282a2c] text-[#e3e3e3] hover:text-white border border-[#333537] hover:border-[#444746] transition-all shadow-sm"
            title={`Open source excerpt from ${doc.filename}`}
          >
            <FileText className="w-3.5 h-3.5 text-[#4285f4] shrink-0" />
            <span className="truncate max-w-[240px] font-medium">{doc.filename}</span>
            <ExternalLink className="w-3 h-3 text-[#8e918f] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
