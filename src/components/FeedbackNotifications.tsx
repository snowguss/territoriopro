import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { Bell, Check, X, BookmarkPlus } from 'lucide-react';
import { format } from 'date-fns';

export const FeedbackNotifications: React.FC = () => {
  const { user } = useAuth();
  const { db: localDb, updateEndereco, updateTerritorio } = useDatabase();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'feedbacks'),
      where('ownerUid', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }) as any);
      // Sort in component explicitly
      data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setFeedbacks(data);
    });

    return () => unsubscribe();
  }, [user]);

  if (feedbacks.length === 0) return null;

  const markAsRead = async (docId: string) => {
    try {
      await updateDoc(doc(db, 'feedbacks', docId), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const applyNotes = async (feedback: any) => {
    try {
      let notes: any = {};
      try {
        notes = JSON.parse(feedback.notes);
      } catch (e) {}

      // Handle the "claim" type notification
      if (notes && notes._CLAIM_) {
        // Find existing territory
        const dateIso = feedback.createdAt?.toDate().toISOString() || new Date().toISOString();
        
        let targetId = '';
        let targetName = '';
        for (const b of localDb.bairros) {
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
        
        if (targetId) {
          // By updating lastAssignedDate, we approve the claim and count it as visited
          updateTerritorio(targetId, targetName, dateIso);
        }

        await markAsRead(feedback.docId);
        return;
      }
      
      // Update each address via context (For regular feedbacks)
      Object.entries(notes).forEach(([enderecoId, noteData]) => {
        // Find existing to preserve other states
        let targetEndereco = null;
        for (const b of localDb.bairros) {
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
          // Fallback to older format if stored merely as a string previously
          const isStringMode = typeof noteData === 'string';
          const incomingObs = isStringMode ? noteData : (noteData as any).obs;
          const incomingStatus = isStringMode ? undefined : (noteData as any).status;

          // DO NOT modify permanent observations!
          const updatedObs = targetEndereco.observations;

          // Replace temporal details
          const updatedStatus = incomingStatus || targetEndereco.status;
          const updatedStatusComment = incomingObs || targetEndereco.statusComment;
          const updatedStatusDate = new Date().toISOString();

          updateEndereco(enderecoId, targetEndereco.street, targetEndereco.number, updatedObs, updatedStatus, updatedStatusComment, updatedStatusDate);
        }
      });

      await markAsRead(feedback.docId);
    } catch (e) {
      console.error("Failed to apply notes", e);
      alert("Falha ao processar solicitação.");
    }
  };

  const claimCount = feedbacks.filter(f => {
    try { const n = JSON.parse(f.notes); return !!n._CLAIM_; } catch(e) { return false; }
  }).length;
  
  const reportCount = feedbacks.length - claimCount;
  const label = claimCount > 0 && reportCount === 0 ? "Novos Pedidos!" : reportCount > 0 && claimCount === 0 ? "Relatórios novos!" : "Novos Lembretes!";

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50">
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg shadow-primary/30 flex items-center gap-2 relative transition-transform hover:scale-105 active:scale-95"
        >
          <Bell size={24} />
          <span className="font-medium pr-2">{label}</span>
          <span className="absolute -top-2 -right-2 bg-error text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-bg">
            {feedbacks.length}
          </span>
        </button>
      )}

      {isOpen && (
        <div className="w-[340px] max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px] animate-in slide-in-from-bottom-5">
          <div className="bg-primary p-4 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 font-semibold">
              <Bell size={18} />
              Central de Notificações ({feedbacks.length})
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-white/70 transition-colors p-1 rounded-md">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 bg-bg space-y-3">
            {feedbacks.map(f => {
              let parsedNotes: any = {};
              try { parsedNotes = JSON.parse(f.notes); } catch(e) {}
              
              const isClaim = !!parsedNotes._CLAIM_;

              // Look up real names since feedback doesn't store them 
              let bName = 'Bairro Desconhecido';
              let tName = 'Território Desconhecido';
              for (const b of localDb.bairros) {
                if (b.id === f.bairroId) {
                  bName = b.name;
                  for (const t of b.territorios) {
                    if (t.id === f.territorioId) {
                      tName = t.name;
                      break;
                    }
                  }
                  break;
                }
              }

              if (isClaim) {
                return (
                  <div key={f.id} className="bg-surface border-2 border-primary/20 p-4 rounded-xl text-sm shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-primary/10 text-primary px-3 py-1 rounded-bl-lg text-xs font-bold flex items-center gap-1.5">
                      <BookmarkPlus size={14} /> PEDIDO DE TERRITÓRIO
                    </div>
                    
                    <div className="flex justify-between items-start mb-2 mt-4">
                      <div className="font-bold text-text-main text-base">{f.publisherName}</div>
                      <div className="text-xs text-text-dim">
                        {f.createdAt ? format(f.createdAt.toDate(), 'dd/MM HH:mm') : ''}
                      </div>
                    </div>
                    <div className="text-sm text-text-dim font-medium mb-3">
                      Pegou o território <span className="text-text-main font-bold">{bName} - {tName}</span> para trabalhar.
                    </div>
                    
                    <p className="text-xs text-text-dim mb-4 italic">
                      Aprovar esta solicitação marcará a data da visita como o momento em que ele fez o pedido.
                    </p>

                    <div className="flex gap-2 relative z-10">
                      <button 
                        onClick={() => applyNotes(f)}
                        className="flex-1 bg-primary text-white py-2 rounded-lg font-medium text-center shadow-sm hover:bg-blue-500 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Check size={16} /> Aprovar
                      </button>
                      <button 
                        onClick={() => markAsRead(f.docId)}
                        className="flex-1 bg-surface-accent text-red-500 py-2 rounded-lg font-medium text-center border border-border hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                );
              }

              // Standard Report format
              const noteEntries = Object.entries(parsedNotes);
              return (
                <div key={f.id} className="bg-surface border border-border p-4 rounded-xl text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-green-500">Relatório: {f.publisherName}</div>
                    <div className="text-xs text-text-dim">
                      {f.createdAt ? format(f.createdAt.toDate(), 'dd/MM HH:mm') : ''}
                    </div>
                  </div>
                  <div className="text-xs text-text-dim font-medium mb-3">
                    {bName} - Território {tName}
                  </div>
                  
                  {noteEntries.length === 0 ? (
                    <div className="text-xs text-text-dim italic mb-4">Nenhuma nota escrita.</div>
                  ) : (
                    <div className="bg-bg rounded-lg border border-border p-2 mb-4 max-h-32 overflow-y-auto space-y-2">
                      {noteEntries.map(([id, noteData]) => {
                        // Find address name to display gracefully
                        let addressName = 'Endereço Indisponível';
                        for (const b of localDb.bairros) {
                          if (b.id === f.bairroId) {
                            for (const t of b.territorios) {
                              if (t.id === f.territorioId) {
                                const end = t.enderecos.find(e => e.id === id);
                                if (end) addressName = `${end.street}, ${end.number}`;
                              }
                            }
                          }
                        }
                        
                        const isStringMode = typeof noteData === 'string';
                        const obs = isStringMode ? noteData : (noteData as any).obs;
                        const status = isStringMode ? undefined : (noteData as any).status;

                        return (
                          <div key={id} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                            <span className="font-medium text-text-main block">{addressName}</span>
                            {status && (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold mt-1 ${
                                status === 'Feito' ? 'bg-green-500/20 text-green-400'
                                : status === 'Não feito' ? 'bg-yellow-500/20 text-yellow-400'
                                : status === 'Não existe' ? 'bg-red-500/20 text-red-400'
                                : 'bg-slate-500/20 text-slate-400'
                              }`}>
                                {status}
                              </span>
                            )}
                            {obs && <span className="text-text-dim break-words block mt-1">"{String(obs)}"</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => applyNotes(f)}
                      className="flex-1 bg-whatsapp text-white py-2 rounded-lg font-medium text-center shadow-sm shadow-whatsapp/20 hover:opacity-90 flex items-center justify-center gap-1.5 transition-opacity"
                    >
                      <Check size={16} /> Aplicar Notas
                    </button>
                    <button 
                      onClick={() => markAsRead(f.docId)}
                      className="flex-1 bg-surface-accent text-text-main py-2 rounded-lg font-medium text-center border border-border hover:bg-border transition-colors flex items-center justify-center gap-1.5"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
