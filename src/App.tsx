/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DatabaseProvider, useDatabase } from './context/DatabaseContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Chat } from './components/Chat';
import { ManualEdit } from './components/ManualEdit';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { FeedbackView } from './components/FeedbackView';
import { FeedbackNotifications } from './components/FeedbackNotifications';
import { MessageSquare, Database as DatabaseIcon, Settings as SettingsIcon, Map, Loader2, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { cn } from './lib/utils';

type Tab = 'chat' | 'database' | 'settings';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const { importState } = useDatabase();
  const { user, logOut } = useAuth();

  return (
    <div className="flex flex-col md:flex-row h-screen bg-bg font-sans text-text-main relative">
      {/* Global Progress Toast */}
      {importState.status !== 'idle' && (
        <div className="fixed top-16 md:top-6 right-4 md:right-6 z-50 bg-surface border border-border rounded-xl shadow-lg p-4 w-72 md:w-80 animate-in slide-in-from-top-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-main flex items-center">
              {importState.isProcessing ? (
                <><Loader2 size={16} className="mr-2 animate-spin text-primary" /> Processando IA...</>
              ) : importState.status === 'success' ? (
                <><CheckCircle2 size={16} className="mr-2 text-whatsapp" /> Concluído!</>
              ) : (
                <><AlertCircle size={16} className="mr-2 text-red-400" /> Falha parcial</>
              )}
            </span>
            <span className="text-xs text-text-dim">{importState.progress}%</span>
          </div>
          <div className="w-full bg-bg rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${importState.status === 'error' ? 'bg-red-400' : importState.status === 'success' ? 'bg-whatsapp' : 'bg-primary'}`}
              style={{ width: `${importState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Real-time feedbacks */}
      <FeedbackNotifications />

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-border shrink-0">
        <div className="font-extrabold text-lg text-primary flex items-center gap-2.5">
          <Map size={20} />
          TERRITORIO PRO
        </div>
        <button onClick={logOut} className="text-text-dim hover:text-text-main">
          <LogOut size={20} />
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[280px] bg-surface border-r border-border flex-col p-6 shrink-0 relative overflow-y-auto">
        <div className="font-extrabold text-lg text-primary mb-8 flex items-center gap-2.5">
          <Map size={20} />
          TERRITORIO PRO
        </div>
        
        <nav className="mb-8 flex-1">
          <div className="text-[11px] uppercase tracking-widest text-text-dim mb-3">Gerenciamento</div>
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-colors mb-1 gap-3",
              activeTab === 'chat' 
                ? "bg-surface-accent text-text-main" 
                : "text-text-dim hover:bg-surface-accent hover:text-text-main"
            )}
          >
            <MessageSquare size={18} />
            Assistente IA
          </button>
          
          <button
            onClick={() => setActiveTab('database')}
            className={cn(
              "w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-colors mb-1 gap-3",
              activeTab === 'database' 
                ? "bg-surface-accent text-text-main" 
                : "text-text-dim hover:bg-surface-accent hover:text-text-main"
            )}
          >
            <DatabaseIcon size={18} />
            Banco de Dados  
          </button>
        </nav>

        <nav className="mb-8">
          <div className="text-[11px] uppercase tracking-widest text-text-dim mb-3">Sistema</div>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-colors mb-1 gap-3",
              activeTab === 'settings' 
                ? "bg-surface-accent text-text-main" 
                : "text-text-dim hover:bg-surface-accent hover:text-text-main"
            )}
          >
            <SettingsIcon size={18} />
            Configurações
          </button>
        </nav>

        <button onClick={logOut} className="w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm text-error hover:bg-error/10 transition-colors gap-3 mb-6">
          <LogOut size={18} />
          Sair
        </button>

        <div className="mt-auto bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-border">
          <div className="text-xs text-text-dim mb-2">Conta logada</div>
          <div className="text-sm font-bold text-secondary truncate" title={user?.email || ''}>{user?.email || 'Nenhuma'}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-bg relative">
        <div className="h-full w-full max-w-5xl mx-auto flex flex-col">
          {activeTab === 'chat' && <Chat />}
          {activeTab === 'database' && <ManualEdit />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden flex bg-surface border-t border-border shrink-0 pb-2">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
            activeTab === 'chat' ? "text-primary" : "text-text-dim hover:text-text-main"
          )}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-medium">Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
            activeTab === 'database' ? "text-primary" : "text-text-dim hover:text-text-main"
          )}
        >
          <DatabaseIcon size={20} />
          <span className="text-[10px] font-medium">Dados</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
            activeTab === 'settings' ? "text-primary" : "text-text-dim hover:text-text-main"
          )}
        >
          <SettingsIcon size={20} />
          <span className="text-[10px] font-medium">Ajustes</span>
        </button>
      </nav>
    </div>
  );
}

const AppRouter = () => {
  const { user, loading } = useAuth();
  
  const searchParams = new URLSearchParams(window.location.search);
  const shareId = searchParams.get('share');

  if (shareId) {
    return <FeedbackView shareId={shareId} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Wrapped in DB provider only when authenticated (to avoid reading offline state incorrectly)
  return (
    <DatabaseProvider>
      <AppContent />
    </DatabaseProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

