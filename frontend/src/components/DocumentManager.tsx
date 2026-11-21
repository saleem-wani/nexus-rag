import React, { useState, useRef } from 'react';
import {
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
  RefreshCw
} from 'lucide-react';
import { DocumentItem } from '../types';

interface DocumentManagerProps {
  documents: DocumentItem[];
  selectedDocIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onInspect: (id: string) => void;
  onRefresh: () => void;
  uploading: boolean;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onUpload,
  onDelete,
  onInspect,
  onRefresh,
  uploading,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderStatusBadge = (doc: DocumentItem) => {
    switch (doc.status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Indexed ({doc.chunk_count} chunks)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Vectorizing...
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Queued
          </span>
        );
      case 'FAILED':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-help"
            title={doc.error_message || 'Indexing failed'}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 p-6 space-y-6 overflow-y-auto">
      {/* Upload Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.csv,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400 shadow-inner">
          {uploading ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <UploadCloud className="w-7 h-7" />
          )}
        </div>

        <h3 className="text-base font-semibold text-white mb-1">
          {uploading ? 'Processing documents...' : 'Click or drag documents here'}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mb-3">
          Supported formats: <span className="text-slate-300 font-medium">PDF, DOCX, TXT, Markdown, CSV</span>.
          Files are automatically parsed, chunked, and embedded into pgvector.
        </p>

        <div className="flex items-center gap-2">
          {['PDF', 'DOCX', 'TXT', 'MD', 'CSV'].map((format) => (
            <span
              key={format}
              className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700"
            >
              .{format.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Documents Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Uploaded Documents
            <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full border border-slate-700">
              {documents.length}
            </span>
          </h2>
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh documents"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search & Bulk Select Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {documents.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onSelectAll}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                title="Select all documents for RAG context"
              >
                All
              </button>
              <button
                onClick={onClearSelection}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                title="Deselect all"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selected Scope Indicator */}
      {documents.length > 0 && (
        <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-indigo-300">
            {selectedDocIds.length === 0
              ? '✨ Searching across ALL uploaded documents by default'
              : `🎯 Scoped to ${selectedDocIds.length} selected document${
                  selectedDocIds.length > 1 ? 's' : ''
                }`}
          </span>
          {selectedDocIds.length > 0 && (
            <button
              onClick={onClearSelection}
              className="text-indigo-400 hover:text-indigo-200 underline text-[11px]"
            >
              Reset to All
            </button>
          )}
        </div>
      )}

      {/* Documents List */}
      <div className="space-y-3">
        {documents.length === 0 ? (
          <div className="text-center py-12 border border-slate-800/80 rounded-2xl bg-slate-950/30">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-300">No documents uploaded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload PDF, Word, or text files above to begin asking questions.
            </p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No documents match "{searchQuery}"
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-slate-900/90 border-indigo-500/50 shadow-sm'
                    : 'bg-slate-950/40 hover:bg-slate-950/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Select Checkbox */}
                  <button
                    onClick={() => onToggleSelect(doc.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate" title={doc.filename}>
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="uppercase font-mono text-[10px] bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                        {doc.file_type}
                      </span>
                      <span>• {formatFileSize(doc.file_size)}</span>
                      <span>• {new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {renderStatusBadge(doc)}

                  {/* Inspect Chunks Button */}
                  {doc.status === 'COMPLETED' && (
                    <button
                      onClick={() => onInspect(doc.id)}
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      title="Inspect Chunks in pgvector"
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-colors"
                    title="Delete document"
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
  );
};

