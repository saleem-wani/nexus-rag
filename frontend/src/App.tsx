import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { ChatView } from './components/ChatView';
import { DocumentDrawer } from './components/DocumentDrawer';
import { SettingsModal } from './components/SettingsModal';
import { EvaluationModal } from './components/EvaluationModal';
import { DocumentItem, ChatMessage, CitationSource, RagDiagnostics, SystemSettings, Conversation } from './types';
import { api } from './api/client';
import { RagDebugView, RagDebugRun } from './components/RagDebugView';

const DEFAULT_SETTINGS: SystemSettings = {
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  topK: 5,
};

export const App: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [streamingSources, setStreamingSources] = useState<CitationSource[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isDocumentDrawerOpen, setIsDocumentDrawerOpen] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<CitationSource | null>(null);
  const [inspectDocId, setInspectDocId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'debug'>('chat');
  const [debugRuns, setDebugRuns] = useState<RagDebugRun[]>([]);

  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const stored = localStorage.getItem('nexus_rag_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Initial load
  useEffect(() => {
    loadHealth();
    loadDocuments();
    loadConversations();
  }, []);

  // Poll documents if any are still PENDING or PROCESSING
  useEffect(() => {
    const hasPending = documents.some((d) => d.status === 'PENDING' || d.status === 'PROCESSING');
    if (!hasPending) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 2500);

    return () => clearInterval(interval);
  }, [documents]);

  const loadHealth = async () => {
    try {
      const health = await api.getHealth();
      setSystemHealth(health);
    } catch (err) {
      console.error('Failed to load health:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const handleSelectConversation = async (convId: string) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setStreamingMessage('');
    setStreamingSources([]);
    try {
      const conv = await api.getConversation(convId);
      setCurrentConvId(conv.id);
      setMessages(conv.messages || []);
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  const handleNewConversation = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setCurrentConvId(null);
    setMessages([]);
    setStreamingMessage('');
    setStreamingSources([]);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConvId === id) {
        handleNewConversation();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    localStorage.setItem('nexus_rag_settings', JSON.stringify(newSettings));
  };

  const handleUploadFiles = async (files: File[]) => {
    const maxFiles = 10;
    const maxFileBytes = 25 * 1024 * 1024;
    const maxBatchBytes = 100 * 1024 * 1024;
    if (files.length > maxFiles) {
      setUploadError(`Choose no more than ${maxFiles} files at once.`);
      return;
    }
    const oversized = files.find((file) => file.size > maxFileBytes);
    if (oversized) {
      setUploadError(`${oversized.name} is over the 25 MiB per-file limit.`);
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > maxBatchBytes) {
      setUploadError('The selected files exceed the 100 MiB combined upload limit.');
      return;
    }
    try {
      setUploadError(null);
      setUploadProgress(0);
      setUploading(true);
      await api.uploadFiles(files, setUploadProgress);
      await loadDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document and all its vector embeddings?')) {
      return;
    }
    try {
      await api.deleteDocument(id);
      setSelectedDocIds((prev) => prev.filter((dId) => dId !== id));
      if (inspectDocId === id) setInspectDocId(null);
      await loadDocuments();
    } catch (err: any) {
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds(documents.map((d) => d.id));
  };

  const handleClearDocSelection = () => {
    setSelectedDocIds([]);
  };

  const handleSelectCitation = (citation: CitationSource) => {
    setActiveCitation(citation);
    setInspectDocId(null);
    setIsDocumentDrawerOpen(true);
  };

  const handleSendMessage = async (text: string) => {
    if (isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamingMessage('');
    setStreamingSources([]);

    abortControllerRef.current = new AbortController();

    let fullGeneratedText = '';
    let capturedSources: CitationSource[] = [];
    let activeConvId = currentConvId;
    const debugRunId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDebugRuns((prev) => [{ id: debugRunId, query: text, status: 'retrieving', answer: '', startedAt: new Date().toISOString() }, ...prev]);

    await api.streamChat({
      message: text,
      conversationId: activeConvId || undefined,
      documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      settings,
      signal: abortControllerRef.current.signal,
      onSources: (sources, convId) => {
        capturedSources = sources;
        setStreamingSources(sources);
        if (convId && !activeConvId) {
          activeConvId = convId;
          setCurrentConvId(convId);
        }
      },
      onDiagnostics: (diagnostics: RagDiagnostics) => {
        setDebugRuns((prev) => prev.map((run) => run.id === debugRunId ? { ...run, diagnostics, status: 'generating' } : run));
      },
      onToken: (token) => {
        fullGeneratedText += token;
        setStreamingMessage((prev) => prev + token);
        setDebugRuns((prev) => prev.map((run) => run.id === debugRunId ? { ...run, answer: fullGeneratedText } : run));
      },
      onDone: (convId) => {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: fullGeneratedText,
          citations: capturedSources,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setDebugRuns((prev) => prev.map((run) => run.id === debugRunId ? { ...run, answer: fullGeneratedText, status: 'completed' } : run));
        setStreamingMessage('');
        setStreamingSources([]);
        setIsStreaming(false);
        if (convId) {
          setCurrentConvId(convId);
          loadConversations();
        }
      },
      onError: (err) => {
        console.error('Streaming error:', err);
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ **Error generating response:** ${err}`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setDebugRuns((prev) => prev.map((run) => run.id === debugRunId ? { ...run, answer: fullGeneratedText, status: 'error', error: err } : run));
        setStreamingMessage('');
        setStreamingSources([]);
        setIsStreaming(false);
      },
    }).finally(() => {
      setIsStreaming(false);
      abortControllerRef.current = null;
    });
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingMessage) {
      const partialMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: streamingMessage + ' *(Generation paused)*',
        citations: streamingSources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, partialMsg]);
    }
    setStreamingMessage('');
    setStreamingSources([]);
    setIsStreaming(false);
  };

  const activeConv = conversations.find((c) => c.id === currentConvId);

  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Left Collapsible Navigation Sidebar */}
      <Sidebar
        conversations={conversations}
        currentConvId={currentConvId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleSelectDoc={handleToggleSelectDoc}
        onOpenDocuments={() => {
          setActiveCitation(null);
          setInspectDocId(null);
          setIsDocumentDrawerOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        systemHealth={systemHealth}
        settings={settings}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar
          currentTitle={activeConv?.title}
          documentCount={documents.length}
          selectedDocCount={selectedDocIds.length}
          onOpenDocuments={() => {
            setActiveCitation(null);
            setInspectDocId(null);
            setIsDocumentDrawerOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenEvaluation={() => setIsEvaluationOpen(true)}
          onClearChat={handleNewConversation}
          hasMessages={messages.length > 0}
          settings={settings}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
        />

        {/* Central Chat View */}
        {activeTab === 'chat' ? <ChatView
          messages={messages}
          streamingMessage={streamingMessage}
          streamingSources={streamingSources}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onStopStreaming={handleStopStreaming}
          onSelectCitation={handleSelectCitation}
          onOpenDocuments={() => {
            setActiveCitation(null);
            setInspectDocId(null);
            setIsDocumentDrawerOpen(true);
          }}
          selectedDocCount={selectedDocIds.length}
          totalDocCount={documents.length}
          settings={settings}
        /> : <RagDebugView runs={debugRuns} />}
      </div>

      {/* Slide-Over Document & Citation Drawer */}
      <DocumentDrawer
        isOpen={isDocumentDrawerOpen}
        onClose={() => setIsDocumentDrawerOpen(false)}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleSelect={handleToggleSelectDoc}
        onSelectAll={handleSelectAllDocs}
        onClearSelection={handleClearDocSelection}
        onUpload={handleUploadFiles}
        onDelete={handleDeleteDocument}
        onRefresh={loadDocuments}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        onDismissUploadError={() => setUploadError(null)}
        activeCitation={activeCitation}
        onClearActiveCitation={() => setActiveCitation(null)}
        inspectDocId={inspectDocId}
        onSelectInspectDocId={(id) => setInspectDocId(id)}
      />

      {/* Model & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <EvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
        settings={settings}
        selectedDocIds={selectedDocIds}
      />
    </div>
  );
};

export default App;
