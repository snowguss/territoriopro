import React, { useEffect, useState } from 'react';
import { db as firestoreDb } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Map, Loader2, Calendar, MapPin, Copy, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface PublicBoardProps {
  boardId: string;
}

export const PublicBoardView: React.FC<PublicBoardProps> = ({ boardId }) => {
  const [loading, setLoading] = useState(true);
  const [initialError, setInitialError] = useState('');
  const [boardData, setBoardData] = useState<any>(null);
  const [territories, setTerritories] = useState<any[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<any | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [publisherName, setPublisherName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedTerritories, setCopiedTerritories] = useState<string[]>([]);

  useEffect(() => {
    const fetchBoard = async () => {
      try {
        const boardRef = doc(firestoreDb, 'boards', boardId);
        const docSnap = await getDoc(boardRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBoardData(data);
          
          if (data.availableTerritories) {
            const parsed = JSON.parse(data.availableTerritories);
            setTerritories(parsed);
          }
        } else {
          setInitialError('Vitrine não encontrada ou desativada.');
        }
      } catch (err) {
        console.error('Failed to fetch board', err);
        setInitialError('Erro ao carregar a vitrine. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBoard();
  }, [boardId]);

  const handlePickTerritory = async () => {
    if (!selectedTerritory) return;
    if (!publisherName.trim()) {
      setStatus({ type: 'error', message: 'Por favor, informe seu nome antes de copiar.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    // Provide a special JSON string in notes to parse it as a claim
    const claimNotes = JSON.stringify({ _CLAIM_: true });
    const claimId = uuidv4();

    try {
      await setDoc(doc(firestoreDb, 'feedbacks', claimId), {
        id: claimId,
        shareId: selectedTerritory.preGeneratedShareId,
        ownerUid: boardData.ownerUid,
        territorioId: selectedTerritory.territorioId,
        bairroId: selectedTerritory.bairroId,
        publisherName: publisherName.trim(),
        notes: claimNotes,
        createdAt: new Date(),
        read: false
      }).catch(err => {
        const errInfo = {
          error: err instanceof Error ? err.message : String(err),
          operationType: 'write',
          path: `feedbacks/${claimId}`,
          authInfo: { userId: null } // Public view, user is likely anonymous or unauthenticated
        };
        console.error('Firestore Error: ', JSON.stringify(errInfo));
        throw new Error(JSON.stringify(errInfo));
      });

      const origin = window.location.origin;
      const shareUrl = `${origin}/?share=${selectedTerritory.preGeneratedShareId}`;
      
      let msg = `📍 ${selectedTerritory.bairroName.toUpperCase()} - TERRITÓRIO ${selectedTerritory.territorioName.toUpperCase()}\n\n`;
      selectedTerritory.enderecos.forEach((end: any, index: number) => {
        msg += `${index + 1}. ${end.street}, ${end.number}\n`;
        if (end.observations) {
          msg += `- ${end.observations}\n`;
        }
      });
      msg += `\nDepois do trabalho, envie o relatório clicando no link abaixo:\n${shareUrl}`;

      await navigator.clipboard.writeText(msg);
      
      setCopiedTerritories([...copiedTerritories, selectedTerritory.preGeneratedShareId]);
      setStatus({ type: 'success', message: 'Mensagem e link copiados! Envie para o administrador.' });
      
      setTimeout(() => {
         setStatus(null);
         setSelectedTerritory(null);
      }, 5000);
      
    } catch(err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erro ao gerar notificação.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg relative overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 md:p-8 relative z-10 animate-pulse">
          <header className="mb-8 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div className="w-10 h-10 bg-surface-accent rounded-xl border border-border" />
              <div>
                <div className="h-6 w-48 bg-surface-accent rounded-md mb-2" />
                <div className="h-4 w-64 bg-surface-accent rounded" />
              </div>
            </div>
            <div className="h-10 w-32 bg-surface-accent rounded-xl mx-auto md:mx-0" />
          </header>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="h-4 w-16 bg-surface-accent rounded mb-2" />
                      <div className="h-5 w-32 bg-surface-accent rounded-md" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-surface-accent" />
                  </div>
                  <div className="h-[1px] w-full bg-border mt-1" />
                  <div className="h-4 w-24 bg-surface-accent rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (initialError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden p-6">
        <div className="bg-surface border border-border p-8 rounded-2xl max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-text-main mb-2">Ops!</h2>
          <p className="text-text-dim">{initialError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg relative overflow-y-auto">
      {/* Background decorations */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[100px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto p-4 md:p-8 relative z-10">
        <header className="mb-8 text-center md:text-left flex flex-col md:flex-row md:items-center md:justify-between py-6">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                <Map size={20} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-text-main">
                {boardData?.congregationName || 'Vitrine de Territórios'}
              </h1>
            </div>
            <p className="text-text-dim text-sm mt-2 max-w-xl">
              Escolha um dos territórios abaixo que aguardam visitação. Ao escolher, você poderá ver os endereços. Para começar, copie a mensagem e cole no WhatsApp para o administrador ficar ciente!
            </p>
          </div>
        </header>

        <div className="bg-surface border border-border p-5 rounded-2xl mb-8 shadow-sm">
          <label className="block text-sm font-semibold text-text-main mb-2">Quem é você?</label>
          <input
            type="text"
            value={publisherName}
            onChange={(e) => setPublisherName(e.target.value)}
            placeholder="Digite o seu nome para avisar o administrador..."
            className="w-full bg-bg border border-border text-text-main rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-dim/50"
          />
        </div>

        {status && (
          <div className={`mb-6 p-4 rounded-xl flex items-center border shadow-lg ${status.type === 'success' ? 'bg-surface text-whatsapp border-whatsapp' : 'bg-surface text-red-400 border-red-400'}`}>
            {status.type === 'success' ? <CheckCircle2 className="mr-3 shrink-0" size={24} /> : <AlertCircle className="mr-3 shrink-0" size={24} />}
            <span className="font-medium">{status.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {territories.map((t, index) => {
            const hasDate = !!t.lastAssignedDate;
            const daysAgo = hasDate ? differenceInDays(new Date(), new Date(t.lastAssignedDate)) : 0;
            const isSelected = selectedTerritory?.preGeneratedShareId === t.preGeneratedShareId;
            const hasBeenCopied = copiedTerritories.includes(t.preGeneratedShareId);
            
            return (
              <div 
                key={index}
                onClick={() => {
                  if (!isSelected && !hasBeenCopied) {
                    setSelectedTerritory(t);
                    setStatus(null);
                  }
                }}
                className={`bg-surface border p-5 rounded-2xl transition-all hover:shadow-lg ${isSelected ? 'border-primary shadow-primary/20 scale-[1.02] cursor-default ring-1 ring-primary/50' : hasBeenCopied ? 'border-whatsapp/50 bg-whatsapp/5 cursor-default' : 'border-border hover:border-text-dim cursor-pointer'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`text-lg font-bold leading-tight flex items-center ${hasBeenCopied ? 'text-whatsapp' : 'text-text-main'}`}>
                      {hasBeenCopied ? <CheckCircle2 size={16} className="mr-1.5 shrink-0" /> : <MapPin size={16} className="text-primary mr-1.5 shrink-0" />}
                      {t.bairroName}
                    </h3>
                    <div className={`text-sm border px-2 py-0.5 rounded-full inline-flex mt-2 font-medium ${hasBeenCopied ? 'bg-whatsapp/10 border-whatsapp/20 text-whatsapp' : 'bg-surface-accent border-border text-text-main'}`}>
                      Território {t.territorioName}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center text-xs">
                  <Calendar size={14} className={`mr-1.5 ${hasBeenCopied ? 'text-whatsapp' : 'text-text-dim'}`} />
                  {hasBeenCopied ? (
                    <span className="text-whatsapp font-medium">Link do território copiado</span>
                  ) : hasDate ? (
                    <span className="text-warning font-medium">Não visitado há {daysAgo} dias</span>
                  ) : (
                    <span className="text-secondary font-medium">Nunca visitado pelo app</span>
                  )}
                </div>

                {isSelected && !hasBeenCopied && (
                  <div className="mt-5 pt-4 border-t border-border animate-in slide-in-from-top-2">
                    
                    {/* Endereços Preview */}
                    {t.enderecos && t.enderecos.length > 0 ? (
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2 flex items-center">
                          <Building2 size={12} className="mr-1" /> Endereços ({t.enderecos.length})
                        </div>
                        <div className="bg-bg border border-border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                          {t.enderecos.map((e: any, i: number) => (
                            <div key={i} className="text-xs text-text-main border-b border-border/40 pb-1 last:border-0 last:pb-0">
                              {e.street}, {e.number}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-text-dim italic mb-4">Nenhum endereço cadastrado.</div>
                    )}

                    <div className="space-y-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePickTerritory();
                        }}
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Copy size={18} />}
                        Copiar Mensagem
                      </button>
                    </div>
                    <p className="text-[10px] text-text-dim text-center mt-2 leading-tight">
                       Irá copiar a mensagem pronta, você deverá enviar manualmente pro administrador.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {territories.length === 0 && (
            <div className="col-span-full bg-surface border border-border p-8 rounded-2xl text-center">
              <div className="w-16 h-16 bg-surface-accent rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                <CheckCircle2 size={32} className="text-text-dim" />
              </div>
              <h3 className="text-lg font-medium text-text-main mb-1">Nenhum território atrasado</h3>
              <p className="text-text-dim text-sm mt-1">Todos os territórios desta congregação/grupo foram trabalhados recentemente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
