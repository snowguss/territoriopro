import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Map, Send, Loader2, CheckCircle2, MessageSquarePlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Endereco } from '../types';
import { cn } from '../lib/utils';

interface FeedbackViewProps {
  shareId: string;
}

interface ShareData {
  id: string;
  ownerUid: string;
  bairroId: string;
  territorioId: string;
  bairroName: string;
  territorioName: string;
  enderecos: string; // JSON string
}

type FeedbackValue = { status?: string; obs?: string; showObs?: boolean };

const STATUS_OPTIONS = ['Feito', 'Não feito', 'Não existe', 'Não visitar'];

export const FeedbackView: React.FC<FeedbackViewProps> = ({ shareId }) => {
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [notes, setNotes] = useState<Record<string, FeedbackValue>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchShare = async () => {
      try {
        const shareRef = doc(db, 'shares', shareId);
        const snap = await getDoc(shareRef);
        if (snap.exists()) {
          const data = snap.data() as ShareData;
          setShareData(data);
          try {
            setEnderecos(JSON.parse(data.enderecos));
          } catch(err) {
            console.error('Failed to parse enderecos', err);
            setEnderecos([]);
          }
        } else {
          setError('Link inválido ou expirado.');
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar território.');
      } finally {
        setLoading(false);
      }
    };
    fetchShare();
  }, [shareId]);

  useEffect(() => {
    if (shareData) {
      const originalTitle = document.title;
      document.title = `${shareData.bairroName} - Território ${shareData.territorioName}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [shareData]);

  const handleStatusChange = (id: string, status: string) => {
    setNotes(prev => ({ 
      ...prev, 
      [id]: { ...(prev[id] || {}), status: prev[id]?.status === status ? undefined : status } 
    }));
  };

  const handleObsChange = (id: string, obs: string) => {
    setNotes(prev => ({ ...prev, [id]: { ...(prev[id] || {}), obs } }));
  };

  const toggleShowObs = (id: string) => {
    setNotes(prev => ({ ...prev, [id]: { ...(prev[id] || {}), showObs: !prev[id]?.showObs } }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Por favor, informe seu nome antes de enviar.');
      return;
    }

    if (!shareData) return;

    try {
      setSubmitting(true);
      const feedbackId = uuidv4();
      const feedbackRef = doc(db, 'feedbacks', feedbackId);
      
      const filteredNotes = Object.entries(notes).reduce((acc, [k, val]) => {
        const v = val as FeedbackValue;
        const trimmedObs = (v.obs || '').trim();
        if (v.status || trimmedObs) {
          acc[k] = { 
            ...(v.status ? { status: v.status } : {}),
            ...(trimmedObs ? { obs: trimmedObs } : {})
          };
        }
        return acc;
      }, {} as Record<string, any>);

      await setDoc(feedbackRef, {
        id: feedbackId,
        shareId: shareData.id,
        ownerUid: shareData.ownerUid,
        territorioId: shareData.territorioId,
        bairroId: shareData.bairroId,
        publisherName: name.trim(),
        notes: JSON.stringify(filteredNotes), // Still safely a JSON string
        createdAt: new Date(),
        read: false
      });
      
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg relative overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8 relative z-10 animate-pulse">
          <div className="text-center mb-8 pt-8">
            <div className="mx-auto w-16 h-16 bg-surface-accent border border-border rounded-xl mb-4" />
            <div className="mx-auto h-8 bg-surface-accent rounded-xl w-[250px] mb-2" />
            <div className="mx-auto h-4 bg-surface-accent rounded max-w-[150px]" />
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-surface border border-border rounded-2xl p-4 md:p-6 p-4">
                <div className="flex flex-col gap-3">
                  <div className="h-5 bg-surface-accent rounded-[4px] w-2/3" />
                  <div className="flex gap-2.5 mt-2">
                    <div className="h-8 w-20 bg-surface-accent rounded-full" />
                    <div className="h-8 w-24 bg-surface-accent rounded-full" />
                    <div className="h-8 w-24 bg-surface-accent rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-error/10 border border-error/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Map size={32} className="text-error" />
          </div>
          <h1 className="text-xl font-bold text-text-main mb-2">Ops! Algo deu errado.</h1>
          <p className="text-text-dim text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-8 flex flex-col items-center shadow-2xl animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-whatsapp/20 border border-whatsapp/40 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-whatsapp" />
          </div>
          <h1 className="text-2xl font-bold text-text-main mb-3 text-center">Muito obrigado!</h1>
          <p className="text-text-dim text-center leading-relaxed">
            Seu relatório de {shareData.territorioName} foi enviado com sucesso. As notas já apareceraram no sistema sincronizado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center">
      <div className="w-full max-w-lg bg-surface border-b border-border p-6 shadow-sm sticky top-0 z-10">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2 mb-1">
          <Map size={18} />
          TERRITORIO PRO
        </h1>
        <h2 className="text-text-main font-semibold text-lg">{shareData.bairroName} - {shareData.territorioName}</h2>
        <p className="text-text-dim text-sm leading-relaxed mt-1">
          Utilize esta página para anotar o que aconteceu em cada endereço durante a pregação.
        </p>
      </div>

      <div className="w-full max-w-lg p-6 flex flex-col gap-6">
        <div className="bg-surface border border-border p-5 rounded-2xl">
          <label className="block text-sm font-medium text-text-main mb-2">Seu Nome (Quem pregou o território?)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: João Silva"
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text-main outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm uppercase tracking-wider font-semibold text-text-dim px-2">Endereços ({enderecos.length})</h3>
          {enderecos.length === 0 ? (
            <p className="text-text-dim text-sm italic px-2">Nenhum endereço encontrado.</p>
          ) : (
            enderecos.map((end, idx) => {
              const currentNote = notes[end.id] || {};
              return (
                <div key={end.id} className="bg-surface border border-border p-4 rounded-2xl flex flex-col">
                  <div className="flex gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-text-main text-base">{end.street}, {end.number}</div>
                      {end.observations && (
                        <div className="text-text-dim text-xs mt-1 bg-bg px-2 py-1.5 rounded-md inline-block">
                          Obs original: {end.observations}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {STATUS_OPTIONS.map(opt => (
                      <button 
                        key={opt}
                        onClick={() => handleStatusChange(end.id, opt)} 
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          currentNote.status === opt 
                            ? opt === 'Feito' ? 'bg-green-500 border-green-500 text-white' 
                              : opt === 'Não feito' ? 'bg-yellow-500 border-yellow-500 text-white'
                              : opt === 'Não existe' ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-slate-800 border-slate-800 text-white'
                            : "border-border text-text-dim bg-bg hover:bg-surface-accent"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {!currentNote.showObs && (
                    <button 
                      onClick={() => toggleShowObs(end.id)}
                      className="text-primary text-xs font-medium flex items-center gap-1.5 w-fit hover:text-primary-hover p-1"
                    >
                      <MessageSquarePlus size={14} /> Adicionar comentário (opcional)
                    </button>
                  )}

                  {currentNote.showObs && (
                    <textarea
                      autoFocus
                      value={currentNote.obs || ''}
                      onChange={e => handleObsChange(end.id, e.target.value)}
                      placeholder="Escreva sua anotação aqui..."
                      className="w-full bg-bg border border-border rounded-xl p-3 text-sm text-text-main outline-none focus:border-primary transition-colors resize-none h-20 animate-in fade-in zoom-in-95 duration-200 mt-2"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
          className="w-full bg-whatsapp hover:bg-emerald-500 text-white font-medium py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-whatsapp/20 mt-4 h-14"
        >
          {submitting ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Send size={18} />
              Enviar Relatório
            </>
          )}
        </button>
        <div className="h-10" /> {/* Bottom padding */}
      </div>
    </div>
  );
};
