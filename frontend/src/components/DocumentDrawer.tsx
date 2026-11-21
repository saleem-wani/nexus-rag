import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  CheckSquare,
  Square,
  Search,
  RefreshCw,
  ArrowLeft,
  Bookmark,
  ExternalLink
} from 'lucide-react';
import { DocumentItem, CitationSource } from '../types';
import { api } from '../api/client';
import { GeminiSparkle } from './GeminiSparkle';

interface DocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  selectedDocIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  onDismissUploadError: () => void;
  activeCitation: CitationSource | null;
  onClearActiveCitation: () => void;
  inspectDocId: string | null;
  onSelectInspectDocId: (id: string | null) => void;
}

export const DocumentDrawer: React.FC<DocumentDrawerProps> = ({
  isOpen,
  onClose,
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onUpload,
  onDelete,
  onRefresh,
  uploading,
  uploadProgress,
  uploadError,
  onDismissUploadError,
  activeCitation,
  onClearActiveCitation,
  inspectDocId,
  onSelectInspectDocId,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectDocDetails, setInspectDocDetails] = useState<DocumentItem | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [chunkSearch, setChunkSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inspectDocId) {
      setInspectDocDetails(null);
      return;
    }
    setInspectLoading(true);
    api.getDocumentDetails(inspectDocId)
      .then((data) => setInspectDocDetails(data))
      .catch((err) => console.error(err))
      .finally(() => setInspectLoading(false));
  }, [inspectDocId]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl h-full bg-[#1e1f20] border-l border-[#333537] flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="h-16 px-6 border-b border-[#282a2c] flex items-center justify-between bg-[#1e1f20]">
          <div className="flex items-center gap-3">
            {activeCitation || inspectDocId ? (
              <button
                onClick={() => {
                  onClearActiveCitation();
                  onSelectInspectDocId(null);
                }}
                className="p-1.5 rounded-full text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : null}

            <div>
              <h3 className="font-heading font-medium text-[#f0f4f9] text-base">
                {activeCitation
                  ? 'Grounded Source'
                  : inspectDocId
                  ? 'Vector Chunks'
                  : 'Document Knowledge Base'}
              </h3>
              <p className="text-xs text-[#8e918f]">
                {activeCitation
                  ? activeCitation.filename
                  : inspectDocId
                  ? inspectDocDetails?.filename || 'Loading...'
                  : `${documents.length} files indexed in PostgreSQL`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!activeCitation && !inspectDocId && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-full text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#c4c7c5] hover:text-white hover:bg-[#282a2c] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VIEW 1: Citation Deep View */}
        {activeCitation ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="bg-[#131314] border border-[#333537] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-[#81c995]/10 text-[#81c995] border border-[#81c995]/20">
                  {Math.round((activeCitation.similarity_score || 0) * 100)}% Match
                </span>
                <span className="text-xs text-[#8e918f] font-mono">
                  Chunk #{activeCitation.chunk_index + 1}
                  {activeCitation.metadata?.page ? ` • Page ${activeCitation.metadata.page}` : ''}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-[#f0f4f9] mb-3">{activeCitation.filename}</h4>
              <div className="p-4 rounded-xl bg-[#1e1f20] border border-[#282a2c] text-xs font-mono text-[#c4c7c5] leading-relaxed whitespace-pre-wrap">
                {activeCitation.content}
              </div>
            </div>

            <button
              onClick={() => onSelectInspectDocId(activeCitation.document_id)}
              className="w-full py-2.5 px-4 rounded-full bg-[#131314] hover:bg-[#282a2c] border border-[#333537] text-xs font-medium text-[#e3e3e3] hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#4285f4]" />
              Inspect All Chunks in Document
            </button>
          </div>
        ) : inspectDocId ? (
          /* VIEW 2: Chunk Inspector */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#282a2c] bg-[#1a1b1c] flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#8e918f] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter chunk text..."
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  className="w-full bg-[#131314] border border-[#333537] rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#4285f4]"
                />
              </div>
              <span className="text-xs text-[#8e918f] shrink-0 font-mono">
                {inspectDocDetails?.chunks?.length || 0} chunks
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {inspectLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#8e918f]">
                  <Loader2 className="w-7 h-7 text-[#4285f4] animate-spin mb-2" />
                  <p className="text-xs">Loading chunks from pgvector...</p>
                </div>
              ) : (
                inspectDocDetails?.chunks
                  ?.filter((c) => c.content.toLowerCase().includes(chunkSearch.toLowerCase()))
                  .map((chunk) => (
                    <div
                      key={chunk.id}
                      className="p-4 rounded-2xl bg-[#131314] border border-[#333537] text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#8e918f]">
                        <span className="font-mono text-[#4285f4] font-medium">
                          Chunk #{chunk.chunk_index + 1}
                        </span>
                        <span>{chunk.content.length} characters</span>
                      </div>
                      <p className="font-mono text-[#c4c7c5] leading-relaxed bg-[#1e1f20] p-3 rounded-xl border border-[#282a2c] whitespace-pre-wrap text-[11px]">
                        {chunk.content}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          /* VIEW 3: Document Manager & Upload */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#4285f4] bg-[#4285f4]/10'
                  : 'border-[#333537] hover:border-[#4285f4]/50 bg-[#131314] hover:bg-[#131314]/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                disabled={uploading}
                accept=".pdf,.docx,.doc,.txt,.md,.csv,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-[#1e1f20] flex items-center justify-center mb-3 text-[#4285f4]">
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <UploadCloud className="w-6 h-6" />
                )}
              </div>

              <p className="text-sm font-medium text-[#f0f4f9] mb-1">
                {uploading ? `Uploading files… ${uploadProgress}%` : 'Add documents to Nexus Knowledge Base'}
              </p>
              <p className="text-xs text-[#8e918f] max-w-xs mb-3">
                Drag and drop PDF, Word, Markdown, CSV, or text files. Up to 10 files, 25 MiB each (100 MiB total).
              </p>

              <div className="flex items-center gap-1.5">
                {['PDF', 'DOCX', 'TXT', 'MD', 'CSV'].map((ext) => (
                  <span
                    key={ext}
                    className="px-2 py-0.5 rounded-full bg-[#1e1f20] text-[10px] font-mono text-[#c4c7c5] border border-[#282a2c]"
                  >
                    .{ext.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>

            {uploading && (
              <div className="h-1.5 w-full rounded-full bg-[#282a2c] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} aria-label="Upload progress">
                <div className="h-full bg-[#4285f4] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            {uploadError && (
              <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                <span>{uploadError}</span>
                <button type="button" onClick={onDismissUploadError} className="shrink-0 text-rose-100 underline">Dismiss</button>
              </div>
            )}

            {/* Document Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8e918f]">
                  Active Documents ({documents.length})
                </span>

                {documents.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={onSelectAll}
                      className="text-[#4285f4] hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-[#444746]">•</span>
                    <button
                      onClick={onClearSelection}
                      className="text-[#8e918f] hover:text-[#c4c7c5]"
                    >
                      Deselect
                    </button>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#131314] border border-[#333537] rounded-full pl-9 pr-3 py-2 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-[#4285f4]"
                />
              </div>

              {/* Document List */}
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#8e918f] border border-[#282a2c] rounded-2xl bg-[#131314]">
                    No documents uploaded yet. Upload a file above.
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#8e918f]">
                    No files match "{searchQuery}"
                  </div>
                ) : (
                  filteredDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);

                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-[#131314] border-[#4285f4]/40 shadow-sm'
                            : 'bg-[#131314]/60 hover:bg-[#131314] border-[#282a2c]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => onToggleSelect(doc.id)}
                            className="text-[#8e918f] hover:text-white shrink-0"
                            title={isSelected ? 'Included in retrieval' : 'Excluded from retrieval'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#4285f4]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#444746]" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <p
                              className="text-xs font-medium text-[#f0f4f9] truncate max-w-[210px]"
                              title={doc.filename}
                            >
                              {doc.filename}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[#8e918f] mt-0.5 font-mono">
                              <span className="uppercase text-[9px] bg-[#282a2c] px-1.5 py-0.2 rounded text-[#c4c7c5]">
                                {doc.file_type}
                              </span>
                              <span>• {formatFileSize(doc.file_size)}</span>
                              <span>• {doc.chunk_count} chunks</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {doc.status === 'PROCESSING' ? (
                            <Loader2 className="w-4 h-4 text-[#4285f4] animate-spin" />
                          ) : doc.status === 'COMPLETED' ? (
                            <button
                              onClick={() => onSelectInspectDocId(doc.id)}
                              className="p-1.5 rounded-full hover:bg-[#282a2c] text-[#8e918f] hover:text-white transition-colors"
                              title="Inspect vector chunks"
                            >
                              <Layers className="w-4 h-4" />
                            </button>
                          ) : null}

                          <button
                            onClick={() => onDelete(doc.id)}
                            className="p-1.5 rounded-full hover:bg-[#282a2c] text-[#8e918f] hover:text-[#f28b82] transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
