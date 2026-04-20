import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, MapPin, UserSquare2, Lightbulb, User, PlusCircle, LayoutDashboard, Map, ClipboardList } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDatabase } from '../context/DatabaseContext';

type WorkspaceTab = 'my_territories' | 'suggestions' | 'add_address';

export function Workspace() {
  const { user, profile, logOut } = useAuth();
  const isDirigente = profile?.role === 'DIRIGENTE';
  
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('my_territories');

  return (
    <div className="flex flex-col md:flex-row h-screen bg-bg font-sans text-text-main relative">
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
      <aside className="hidden md:flex w-[260px] bg-surface border-r border-border flex-col p-6 shrink-0 relative overflow-y-auto">
        <div className="font-extrabold text-lg text-primary mb-8 flex items-center gap-2.5">
          <Map size={20} />
          TERRITORIO PRO
        </div>
        
        <nav className="mb-8 flex-1">
          <div className="text-[11px] uppercase tracking-widest text-text-dim mb-3">Menu</div>
          
          <button
            onClick={() => setActiveTab('my_territories')}
            className={cn(
              "w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-colors mb-1 gap-3",
              activeTab === 'my_territories' 
                ? "bg-surface-accent text-text-main" 
                : "text-text-dim hover:bg-surface-accent hover:text-text-main"
            )}
          >
            <UserSquare2 size={18} />
            Meus Territórios
          </button>

          {isDirigente && (
            <button
              onClick={() => setActiveTab('suggestions')}
              className={cn(
                "w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-colors mb-1 gap-3",
                activeTab === 'suggestions' 
                  ? "bg-surface-accent text-text-main" 
                  : "text-text-dim hover:bg-surface-accent hover:text-text-main"
              )}
            >
              <Lightbulb size={18} />
              Sugestões de Visita
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('add_address')}
            className={cn(
              "w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm transition-colors mb-1 gap-3",
              activeTab === 'add_address' 
                ? "bg-surface-accent text-text-main" 
                : "text-text-dim hover:bg-surface-accent hover:text-text-main"
            )}
          >
            <PlusCircle size={18} />
            Sugerir Endereço
          </button>
        </nav>

        <button onClick={logOut} className="w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm text-error hover:bg-error/10 transition-colors gap-3 mb-6">
          <LogOut size={18} />
          Sair
        </button>

        <div className="mt-auto flex flex-col gap-1 items-start bg-bg rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-accent text-primary uppercase tracking-wide">
              {profile?.role}
            </span>
          </div>
          <div className="text-sm font-bold text-text-main truncate w-full" title={user?.email || ''}>{user?.email}</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-bg p-4 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
          {activeTab === 'my_territories' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <UserSquare2 className="text-primary" /> Meus Territórios
                </h1>
                <p className="text-text-dim text-sm mt-1">Territórios que estão atualmente designados para você trabalhar.</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center">
                <ClipboardList size={40} className="text-text-dim mb-4 opacity-50" />
                <h3 className="font-semibold text-lg">Nenhum território ativo</h3>
                <p className="text-text-dim text-sm max-w-md mx-auto mt-2">
                  Você não possui territórios vinculados no momento. {isDirigente ? "Acesse a aba 'Sugestões de Visita' para pegar um território disponível." : "Solicite ao seu administrador para enviar um território para você."}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'suggestions' && isDirigente && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Lightbulb className="text-warning" /> Sugestões de Visita
                </h1>
                <p className="text-text-dim text-sm mt-1">Territórios congelados na base aguardando novos publicadores.</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center">
                 {/* Aqui iremos integrar futuramente a vitrine de sugestões chamando os hooks do BD parecido com o Dashboard */}
                 <LayoutDashboard size={40} className="text-text-dim mb-4 opacity-50" />
                 <h3 className="font-semibold text-lg">Vitrine em Construção</h3>
                 <p className="text-text-dim text-sm max-w-md mx-auto mt-2">
                   Em breve todos os territórios sugeridos listados na Master aparecerão aqui para você clicar em "Pegar Território".
                 </p>
              </div>
            </div>
          )}

          {activeTab === 'add_address' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <PlusCircle className="text-blue-500" /> Sugerir Endereço
                </h1>
                <p className="text-text-dim text-sm mt-1">Adicione um novo endereço. Ele será enviado para aprovação do Administrador.</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center">
                 <MapPin size={40} className="text-text-dim mb-4 opacity-50" />
                 <h3 className="font-semibold text-lg">Fila de Aprovação (Em Breve)</h3>
                 <p className="text-text-dim text-sm max-w-md mx-auto mt-2">
                   Em breve você poderá preencher os formulários apontando a rua e número encontrados. Eles cairão diretamente no Inbox do Administrador!
                 </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden flex bg-surface border-t border-border shrink-0 pb-2">
        <button
          onClick={() => setActiveTab('my_territories')}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
            activeTab === 'my_territories' ? "text-primary" : "text-text-dim hover:text-text-main"
          )}
        >
          <UserSquare2 size={20} />
          <span className="text-[10px] font-medium truncate">Meus Territ.</span>
        </button>

        {isDirigente && (
          <button
            onClick={() => setActiveTab('suggestions')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
              activeTab === 'suggestions' ? "text-warning" : "text-text-dim hover:text-text-main"
            )}
          >
            <Lightbulb size={20} />
            <span className="text-[10px] font-medium truncate">Sugestões</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('add_address')}
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
            activeTab === 'add_address' ? "text-blue-500" : "text-text-dim hover:text-text-main"
          )}
        >
          <PlusCircle size={20} />
          <span className="text-[10px] font-medium truncate">Sugerir</span>
        </button>
      </nav>
    </div>
  );
}
