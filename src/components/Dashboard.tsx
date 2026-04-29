import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { db as firestoreDb } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { Home, MapPin, Map, Bell, AlertCircle, Check, X, BookmarkPlus, Plus, Info, MessageCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Bairro, Territorio } from '../types';

export const Dashboard: React.FC = () => {
  const { db, addBairro, addTerritorio, addEndereco, updateEndereco, updateTerritorio } = useDatabase();
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  
  const [modalState, setModalState] = useState<any>({ type: 'none' });
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showMatches, setShowMatches] = useState(false);

  // --- Feedback Logic ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(firestoreDb, 'feedbacks'), where('ownerUid', '==', user.uid), where('read', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }) as any);
      data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setFeedbacks(data);
    }, (error) => {
      const errInfo = {
        error: error.message,
        operationType: 'get',
        path: 'feedbacks',
        authInfo: { userId: user?.uid }
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (docId: string) => {
    try { await updateDoc(doc(firestoreDb, 'feedbacks', docId), { read: true }); } catch (e) { console.error(e); }
  };

  const applyNotes = async (feedback: any) => {
    try {
      let notes: any = {};
      try { notes = JSON.parse(feedback.notes); } catch (e) {}

      if (notes && notes._CLAIM_) {
        const dateIso = feedback.createdAt?.toDate().toISOString() || new Date().toISOString();
        let targetId = '';
        let targetName = '';
        for (const b of db.bairros) {
          if (b.id === feedback.bairroId) {
            for (const t of b.territorios) {
              if (t.id === feedback.territorioId) {
                targetId = t.id;
                targetName = t.name;
                break;
              }
            }
          }
        }
        if (targetId) updateTerritorio(targetId, targetName, dateIso);
        await markAsRead(feedback.docId);
        return;
      }
      
      Object.entries(notes).forEach(([enderecoId, noteData]) => {
        let targetEndereco = null;
        for (const b of db.bairros) {
          if (b.id === feedback.bairroId) {
            for (const t of b.territorios) {
              if (t.id === feedback.territorioId) {
                targetEndereco = t.enderecos.find(e => e.id === enderecoId);
                break;
              }
            }
          }
        }
        if (targetEndereco) {
          const isStringMode = typeof noteData === 'string';
          const incomingObs = isStringMode ? noteData : (noteData as any).obs;
          const incomingStatus = isStringMode ? undefined : (noteData as any).status;
          const updatedObs = targetEndereco.observations;
          const updatedStatus = incomingStatus || targetEndereco.status;
          const updatedStatusComment = incomingObs || targetEndereco.statusComment;
          const updatedStatusDate = new Date().toISOString();
          updateEndereco(enderecoId, targetEndereco.street, targetEndereco.number, updatedObs, updatedStatus, updatedStatusComment, updatedStatusDate);
        }
      });
      await markAsRead(feedback.docId);
    } catch (e) {
      console.error(e);
      alert("Falha ao processar.");
    }
  };

  // --- Suggestions Logic ---
  const today = new Date();
  const suggestions: any[] = [];
  db.bairros.forEach(bairro => {
    bairro.territorios.forEach(territorio => {
      if (!territorio.lastAssignedDate) {
        suggestions.push({ bairro, territorio, days: null });
      } else {
        const days = differenceInDays(today, new Date(territorio.lastAssignedDate));
        if (days > 20) suggestions.push({ bairro, territorio, days });
      }
    });
  });
  suggestions.sort((a, b) => {
    if (a.days === null && b.days === null) return 0;
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });

  // --- Modals Logic ---
  const handleCopyWhatsApp = async (bairro: Bairro, territorio: Territorio) => {
    try {
      const shareId = Math.random().toString(36).substring(2, 10);
      const origin = window.location.origin;
      const shareRef = doc(firestoreDb, 'shares', shareId);
      
      const currentAuth = (await import('firebase/auth')).getAuth();
      if (!currentAuth.currentUser) {
        alert("Erro: Você precisa estar logado para gerar o link do território.");
        return;
      }
      
      await import('firebase/firestore').then(({ setDoc }) => {
        return setDoc(shareRef, {
          id: shareId,
          ownerUid: currentAuth.currentUser?.uid,
          bairroId: bairro.id,
          territorioId: territorio.id,
          bairroName: bairro.name,
          territorioName: territorio.name,
          enderecos: JSON.stringify(territorio.enderecos),
          createdAt: new Date()
        });
      }).catch(err => {
        const errInfo = {
          error: err instanceof Error ? err.message : String(err),
          operationType: 'write',
          path: `shares/${shareId}`,
          authInfo: { userId: currentAuth.currentUser?.uid }
        };
        console.error('Firestore Error: ', JSON.stringify(errInfo));
        throw new Error(JSON.stringify(errInfo));
      });

      const shareUrl = `${origin}?share=${shareId}`;
      const msg = `Você pegou o ${bairro.name} - ${territorio.name}! Acesse sua lista de endereços aqui: ${shareUrl}`;
      await navigator.clipboard.writeText(msg);
      alert('Mensagem copiada para a área de transferência!');
    } catch (err) {
      console.error('Falha ao copiar:', err);
      alert('Não foi possível copiar: ' + (err as Error).message);
    }
  };

  const smartStreetMatches = React.useMemo(() => {
    if (modalState.type !== 'smart_add_endereco' || !formData.street || formData.street.length < 3) return [];
    const search = formData.street.toLowerCase();
    const matches: {street: string, defaultBairroId: string, defaultTerritorioId: string, bairroName: string, territorioName: string}[] = [];
    const uniqueStreets = new Set<string>();
    db.bairros.forEach(b => {
      b.territorios.forEach(t => {
        t.enderecos.forEach(e => {
          if (e.street.toLowerCase().includes(search)) {
            const key = e.street.toLowerCase();
            if (!uniqueStreets.has(key)) {
              uniqueStreets.add(key);
              matches.push({ street: e.street, defaultBairroId: b.id, defaultTerritorioId: t.id, bairroName: b.name, territorioName: t.name });
            }
          }
        });
      });
    });
    return matches.slice(0, 5);
  }, [formData.street, db, modalState.type]);

  const handleSave = () => {
    switch (modalState.type) {
      case 'add_bairro':
        if (formData.name) addBairro(formData.name);
        break;
      case 'add_territorio':
        if (formData.selectedBairroId && formData.name) addTerritorio(formData.selectedBairroId, formData.name);
        break;
      case 'smart_add_endereco':
        if (formData.street && formData.number && formData.selectedTerritorioId) {
          addEndereco(formData.selectedTerritorioId, formData.street, formData.number, formData.observations, undefined, undefined, undefined);
        } else {
          alert('Preencha a rua, número e selecione Bairro/Território para salvar.');
          return;
        }
        break;
    }
    setModalState({ type: 'none' });
    setFormData({});
  };

  return (
    <div className="p-4 md:p-6 bg-bg h-full overflow-y-auto w-full">
      <h2 className="text-xl md:text-2xl font-bold text-text-main mb-6 flex items-center">
        <Home className="mr-2 text-primary" /> Início
      </h2>

      {/* Hero Bento Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <button
          onClick={() => { setModalState({ type: 'smart_add_endereco' }); setFormData({ street: '', number: '', observations: '', selectedBairroId: '', selectedTerritorioId: '' }); setShowMatches(true); }}
          className="bg-surface-accent border border-border/50 hover:border-primary/50 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center sm:text-left transition-all hover:shadow-lg group flex flex-col sm:block items-center"
        >
          <div className="bg-primary/10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
            <Home size={20} className="text-primary sm:w-6 sm:h-6" />
          </div>
          <h3 className="font-semibold text-xs sm:text-lg text-text-main sm:mb-1">Endereço</h3>
          <p className="hidden sm:block text-sm text-text-dim">Registre novos endereços de forma inteligente.</p>
        </button>

        <button
          onClick={() => { setModalState({ type: 'add_bairro' }); setFormData({ name: '' }); }}
          className="bg-surface-accent border border-border/50 hover:border-blue-400/50 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center sm:text-left transition-all hover:shadow-lg group flex flex-col sm:block items-center"
        >
          <div className="bg-blue-400/10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
            <MapPin size={20} className="text-blue-400 sm:w-6 sm:h-6" />
          </div>
          <h3 className="font-semibold text-xs sm:text-lg text-text-main sm:mb-1">Bairro</h3>
          <p className="hidden sm:block text-sm text-text-dim">Adicione novas regiões à sua base.</p>
        </button>

        <button
          onClick={() => { setModalState({ type: 'add_territorio' }); setFormData({ name: '', selectedBairroId: '' }); }}
          className="bg-surface-accent border border-border/50 hover:border-secondary/50 rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center sm:text-left transition-all hover:shadow-lg group flex flex-col sm:block items-center"
        >
          <div className="bg-secondary/10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
            <Map size={20} className="text-secondary sm:w-6 sm:h-6" />
          </div>
          <h3 className="font-semibold text-xs sm:text-lg text-text-main sm:mb-1">Território</h3>
          <p className="hidden sm:block text-sm text-text-dim">Crie partições dentro dos bairros.</p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Suggestions */}
        <div className="order-2 lg:order-1 lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-2xl flex flex-col flex-1 max-h-[350px] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center sticky top-0 bg-surface z-10 shrink-0">
              <AlertCircle size={20} className="text-warning mr-2" />
              <h3 className="font-semibold text-lg text-text-main">Sugestões de Visita</h3>
              <span className="ml-auto bg-surface-accent px-2 py-0.5 rounded-full text-xs font-bold text-text-dim">{suggestions.length}</span>
            </div>
            {suggestions.length === 0 ? (
              <div className="p-6 text-center text-text-dim italic">A base de dados está perfeitamente atualizada!</div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto">
                {suggestions.map((sug, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => { setModalState({ type: 'preview_territorio', bairro: sug.bairro, territorio: sug.territorio }); }}
                    className="bg-bg border border-border rounded-xl p-4 flex flex-col hover:border-primary/30 transition-colors text-left"
                  >
                    <div className="font-medium text-text-main truncate text-sm w-full">{sug.bairro.name}</div>
                    <div className="text-xs text-text-dim truncate mb-3 w-full">Território {sug.territorio.name}</div>
                    <div className="mt-auto flex justify-between items-center w-full">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-surface-accent text-warning uppercase tracking-wide">
                        {sug.days === null ? 'Nunca visitado' : `Há ${sug.days} dias`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Notifications */}
        <div className="order-1 lg:order-2 lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-2xl flex flex-col flex-1 max-h-[600px] overflow-hidden">
            <div className="p-5 border-b border-border flex items-center sticky top-0 bg-surface z-10">
              <Bell size={20} className="text-primary mr-2" />
              <h3 className="font-semibold text-lg text-text-main">Notificações</h3>
              {feedbacks.length > 0 && <span className="ml-auto bg-primary text-white px-2 py-0.5 rounded-full text-xs font-bold">{feedbacks.length} novos</span>}
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              {feedbacks.length === 0 ? (
                <div className="p-8 text-center text-text-dim flex flex-col items-center">
                  <Bell size={32} className="mb-2 opacity-20" />
                  Nenhuma notificação nova.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {feedbacks.map(f => {
                    let parsedNotes: any = {};
                    try { parsedNotes = JSON.parse(f.notes); } catch(e) {}
                    const isClaim = !!parsedNotes._CLAIM_;

                    let bName = 'Desconhecido';
                    let tName = 'Desconhecido';
                    for (const b of db.bairros) {
                      if (b.id === f.bairroId) {
                        bName = b.name;
                        for (const t of b.territorios) {
                          if (t.id === f.territorioId) {
                            tName = t.name; break;
                          }
                        }
                        break;
                      }
                    }

                    return (
                      <div key={f.docId} className="p-4 hover:bg-surface-accent/50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isClaim ? 'bg-primary/20 text-primary' : 'bg-whatsapp/20 text-whatsapp'}`}>
                            {isClaim ? 'PEDIDO' : 'RELATÓRIO'}
                          </span>
                          <span className="text-[10px] text-text-dim">{f.createdAt ? format(f.createdAt.toDate(), 'dd/MM HH:mm') : ''}</span>
                        </div>
                        <div className="font-bold text-text-main text-sm mt-2">{f.publisherName}</div>
                        <div className="text-xs text-text-dim mb-3">
                          {isClaim ? 'Pegou para trabalhar' : 'Enviou um relatório'} - <span className="text-text-main font-medium">{bName} / {tName}</span>
                        </div>

                        {!isClaim && Object.entries(parsedNotes).length > 0 && (
                          <div className="bg-bg rounded-lg border border-border p-2 mb-3 max-h-24 overflow-y-auto space-y-2">
                            {Object.entries(parsedNotes).map(([id, noteData]: [string, any]) => {
                                let addressName = '...';
                                for (const b of db.bairros) {
                                  if (b.id === f.bairroId) {
                                    for (const t of b.territorios) {
                                      if (t.id === f.territorioId) {
                                        const end = t.enderecos.find((e:any) => e.id === id);
                                        if (end) addressName = `${end.street}, ${end.number}`;
                                      }
                                    }
                                  }
                                }
                                const isStringMode = typeof noteData === 'string';
                                const obs = isStringMode ? noteData : noteData.obs;
                                const status = isStringMode ? undefined : noteData.status;

                                return (
                                  <div key={id} className="text-[10px] border-b border-border/50 pb-1 last:border-0 last:pb-0">
                                    <span className="font-semibold text-text-main block">{addressName}</span>
                                    {status && <span className="text-primary italic mr-1">[{status}]</span>}
                                    {obs && <span className="text-text-dim break-words">"{String(obs)}"</span>}
                                  </div>
                                );
                            })}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => applyNotes(f)} className="flex-1 bg-surface-accent text-text-main border border-border py-1.5 rounded-md text-xs font-semibold hover:bg-border transition-colors">
                            {isClaim ? 'Aprovar' : 'Aplicar'}
                          </button>
                          <button onClick={() => markAsRead(f.docId)} className="flex-1 text-text-dim py-1.5 rounded-md text-xs font-semibold hover:text-red-400 transition-colors">
                            Dispensar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Simple Modals copied from ManualEdit for Quick Actions */}
      <Modal 
        isOpen={modalState.type !== 'none'} 
        onClose={() => { setModalState({type: 'none'}); setFormData({}); }}
        title={
          modalState.type === 'smart_add_endereco' ? 'Adicionar Endereço Rápido' :
          modalState.type === 'add_bairro' ? 'Novo Bairro' :
          modalState.type === 'add_territorio' ? 'Novo Território' : 
          modalState.type === 'preview_territorio' ? 'Visualizar Território' : ''
        }
      >
        <div className="space-y-4">
          {modalState.type === 'preview_territorio' && modalState.bairro && modalState.territorio && (
            <div className="flex flex-col gap-4">
              <div className="bg-surface-accent p-4 rounded-xl border border-border">
                <div className="font-bold text-text-main text-lg mb-1">{modalState.bairro.name}</div>
                <div className="text-text-dim font-medium mb-4">Território {modalState.territorio.name}</div>
                
                <div className="bg-bg rounded-lg border border-border p-3 max-h-[300px] overflow-y-auto w-full">
                  {modalState.territorio.enderecos.length === 0 ? (
                    <div className="text-sm text-text-dim italic text-center py-4">Nenhum endereço cadastrado.</div>
                  ) : (
                    <div className="space-y-3">
                      {modalState.territorio.enderecos.map((end: any) => (
                        <div key={end.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0 text-left">
                          <div className="font-semibold text-text-main text-sm">{end.street}, {end.number}</div>
                          {end.observations && (
                            <div className="text-xs text-text-dim mt-1 italic break-words">"{end.observations}"</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => handleCopyWhatsApp(modalState.bairro, modalState.territorio)}
                className="w-full bg-whatsapp text-white py-3 rounded-xl font-medium shadow-sm hover:bg-green-500 flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle size={18} /> Copiar P/ WhatsApp
              </button>
            </div>
          )}

          {modalState.type === 'smart_add_endereco' && (
            <div className="mb-4 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-text-dim mb-1">Buscar ou Digitar Rua</label>
                <input 
                  type="text" 
                  value={formData.street || ''} 
                  onChange={e => {
                    setFormData({ ...formData, street: e.target.value, selectedTerritorioId: '', selectedBairroId: '' });
                    setShowMatches(true);
                  }}
                  onFocus={() => setShowMatches(true)}
                  className="w-full bg-bg border border-primary/50 text-text-main rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Digite o nome da rua..."
                  autoFocus
                />
                {showMatches && smartStreetMatches.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-md shadow-lg overflow-hidden">
                    {smartStreetMatches.map((m, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-accent border-b border-border/50 last:border-0"
                        onClick={() => {
                          setFormData({ ...formData, street: m.street, selectedBairroId: m.defaultBairroId, selectedTerritorioId: m.defaultTerritorioId });
                          setShowMatches(false);
                        }}
                      >
                        <div className="font-medium text-text-main">{m.street}</div>
                        <div className="text-xs text-text-dim text-primary/80">
                          {m.bairroName} • Território {m.territorioName}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-dim mb-1">Bairro</label>
                  <select 
                    value={formData.selectedBairroId || ''} 
                    onChange={e => setFormData({ ...formData, selectedBairroId: e.target.value, selectedTerritorioId: '' })}
                    className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 outline-none"
                  >
                    <option value="" disabled>Selecione ou busque na tabela...</option>
                    {db.bairros.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-dim mb-1">Território</label>
                  <select 
                    value={formData.selectedTerritorioId || ''} 
                    onChange={e => setFormData({ ...formData, selectedTerritorioId: e.target.value })}
                    className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 outline-none"
                    disabled={!formData.selectedBairroId}
                  >
                    <option value="" disabled>Selecione...</option>
                    {db.bairros.find(b => b.id === formData.selectedBairroId)?.territorios.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.selectedTerritorioId && (
                <div className="p-3 bg-surface-accent/30 border border-border/50 rounded-lg">
                  <div className="text-xs font-semibold text-text-dim mb-1 flex items-center">
                    <Info size={12} className="mr-1" /> Ruas cadastradas neste território:
                  </div>
                  <div className="text-xs text-text-main leading-relaxed">
                    {(() => {
                      const b = db.bairros.find(x => x.id === formData.selectedBairroId);
                      if (!b) return null;
                      const t = b.territorios.find(x => x.id === formData.selectedTerritorioId);
                      if (!t || t.enderecos.length === 0) return <span className="italic text-text-dim">Nenhuma rua cadastrada ainda.</span>;
                      return Array.from(new Set(t.enderecos.map(e => e.street))).join(', ');
                    })()}
                  </div>
                </div>
              )}
              
              <hr className="border-border/50" />
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Número</label>
                <input 
                  type="text" 
                  value={formData.number || ''} 
                  onChange={e => setFormData({ ...formData, number: e.target.value })}
                  className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Observações Permanentes (Opcional)</label>
                <input 
                  type="text" 
                  value={formData.observations || ''} 
                  onChange={e => setFormData({ ...formData, observations: e.target.value })}
                  className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          )}

          {modalState.type === 'add_bairro' && (
            <div>
              <label className="block text-sm font-medium text-text-dim mb-1">Nome do Bairro</label>
              <input 
                type="text" 
                value={formData.name || ''} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                autoFocus
              />
            </div>
          )}

          {modalState.type === 'add_territorio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Bairro</label>
                <select 
                  value={formData.selectedBairroId || ''} 
                  onChange={e => setFormData({ ...formData, selectedBairroId: e.target.value })}
                  className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 outline-none"
                >
                  <option value="" disabled>Selecione...</option>
                  {db.bairros.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Nome/Número do Território</label>
                <input 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Ex: 6 ou Território 6"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
            <button 
              onClick={() => { setModalState({type: 'none'}); setFormData({}); }}
              className="px-4 py-2 text-text-main bg-surface-accent hover:bg-border rounded-md font-medium transition-colors"
            >
              {modalState.type === 'preview_territorio' ? 'Fechar' : 'Cancelar'}
            </button>
            {modalState.type !== 'preview_territorio' && (
              <button 
                onClick={handleSave}
                className="px-4 py-2 text-white bg-primary hover:bg-blue-400 rounded-md font-medium transition-colors"
              >
                Salvar
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
