import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, MapPin, Home, Map, MessageCircle, Check, AlertCircle, GripVertical, Share2, Link, MessageSquarePlus } from 'lucide-react';
import { Bairro, Territorio, Endereco } from '../types';
import { format, differenceInDays } from 'date-fns';
import { Modal } from './Modal';
import { 
  DndContext, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
  useDroppable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';
import { db as firestoreDb } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';

type ModalState = 
  | { type: 'none' }
  | { type: 'add_bairro' }
  | { type: 'edit_bairro', id: string, name: string }
  | { type: 'add_territorio', bairroId: string }
  | { type: 'edit_territorio', id: string, name: string, lastAssignedDate?: string }
  | { type: 'add_endereco', territorioId: string }
  | { type: 'edit_endereco', id: string, street: string, number: string, observations: string, status?: string, statusComment?: string, statusDate?: string }
  | { type: 'confirm_delete', entityType: 'bairro' | 'territorio' | 'endereco', id: string, name: string }
  | { type: 'share_link', url: string };

interface SortableTerritorioProps {
  bairro: Bairro;
  territorio: Territorio;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onAddEndereco: (territorioId: string) => void;
  onEdit: (territorio: Territorio) => void;
  onDelete: (id: string, name: string) => void;
  onCopy: (bairro: Bairro, territorio: Territorio) => void;
  onShare: (bairro: Bairro, territorio: Territorio) => void;
  copiedId: string | null;
  onEditEndereco: (endereco: Endereco) => void;
  onDeleteEndereco: (id: string, name: string) => void;
}

const SortableTerritorioItem: React.FC<SortableTerritorioProps> = ({ 
  bairro, territorio, isExpanded, onToggle, onAddEndereco, onEdit, onDelete, onCopy, onShare, copiedId, onEditEndereco, onDeleteEndereco 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: territorio.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-border rounded-md ml-2 md:ml-6 bg-bg overflow-hidden">
      <div className="px-2 py-2 md:px-3 flex justify-between items-center text-sm bg-surface">
        <div 
          className="flex items-center cursor-pointer flex-1 font-medium text-text-main flex-wrap gap-y-1"
          onClick={() => onToggle(territorio.id)}
        >
          <div className="flex items-center mr-2 cursor-grab active:cursor-grabbing p-1 hover:bg-surface-accent rounded" {...attributes} {...listeners}>
            <GripVertical size={14} className="text-text-dim" />
          </div>
          <div className="flex items-center">
            {isExpanded ? <ChevronDown size={16} className="mr-1 text-text-dim shrink-0" /> : <ChevronRight size={16} className="mr-1 text-text-dim shrink-0" />}
            <Map size={14} className="mr-2 text-secondary shrink-0" />
            <span className="truncate">Território {territorio.name}</span>
          </div>
          {territorio.lastAssignedDate && (
            <span className="ml-0 sm:ml-3 text-[10px] sm:text-xs font-normal text-warning bg-surface-accent border border-border px-2 py-0.5 rounded-full whitespace-nowrap">
              Última visita: {format(new Date(territorio.lastAssignedDate), 'dd/MM/yyyy')}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1 ml-2 shrink-0">
          <button 
            onClick={() => onShare(bairro, territorio)} 
            className="text-primary hover:text-blue-400 p-1 mr-1" 
            title="Gerar Link de Feedback"
          >
            <Share2 size={14} />
          </button>
          <button 
            onClick={() => onCopy(bairro, territorio)} 
            className="text-whatsapp hover:text-green-400 p-1 mr-1" 
            title="Copiar mensagem para WhatsApp"
          >
            {copiedId === territorio.id ? <Check size={14} /> : <MessageCircle size={14} />}
          </button>
          <button onClick={() => onAddEndereco(territorio.id)} className="text-primary hover:text-blue-400 p-1" title="Adicionar Endereço">
            <Plus size={14} />
          </button>
          <button onClick={() => onEdit(territorio)} className="text-text-dim hover:text-text-main p-1" title="Editar Território">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(territorio.id, `Território ${territorio.name}`)} className="text-red-400 hover:text-red-300 p-1" title="Remover Território">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-2 md:p-3 border-t border-border">
          {territorio.enderecos.length === 0 ? (
            <div className="text-xs text-text-dim pl-4 md:pl-6">Nenhum endereço neste território.</div>
          ) : (
            <ul className="space-y-2 pl-4 md:pl-6">
              {territorio.enderecos.map(endereco => (
                <li key={endereco.id} className="flex justify-between items-start text-sm group">
                  <div className="flex items-start pr-2">
                    <Home size={14} className="mr-2 mt-0.5 text-text-dim shrink-0" />
                    <div className="break-words w-full pr-2">
                      <div className="flex items-start flex-wrap gap-x-2 gap-y-1">
                        <span className="font-medium text-text-main">{endereco.street}, {endereco.number}</span>
                        {endereco.status && (
                          <span className={cn(
                            "inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold self-center shadow-sm",
                            endereco.status === 'Feito' ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : endereco.status === 'Não feito' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                            : endereco.status === 'Não existe' ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                          )}>
                            {endereco.status}
                          </span>
                        )}
                      </div>
                      {endereco.statusComment && (
                        <div className="text-xs text-text-dim mt-1 bg-surface py-1 px-2 rounded border border-border/50">
                          <MessageSquarePlus size={12} className="inline mr-1 opacity-70" />
                          <span className="italic">"{endereco.statusComment}"</span>
                        </div>
                      )}
                      {endereco.observations && (
                        <div className="text-xs text-text-dim mt-1">Obs: {endereco.observations}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => onEditEndereco(endereco)} className="text-text-dim hover:text-text-main p-1">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => onDeleteEndereco(endereco.id, `${endereco.street}, ${endereco.number}`)} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

interface BairroHeaderProps {
  bairro: Bairro;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onAddTerritorio: (bairroId: string) => void;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

const BairroHeader: React.FC<BairroHeaderProps> = ({ 
  bairro, isExpanded, onToggle, onAddTerritorio, onEdit, onDelete 
}) => {
  const { setNodeRef, isOver } = useDroppable({ 
    id: bairro.id
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "px-3 py-3 md:px-4 flex justify-between items-center bg-surface-accent transition-colors",
        isOver && "bg-primary/20"
      )}
    >
      <div 
        className="flex items-center cursor-pointer flex-1 font-medium text-text-main"
        onClick={() => onToggle(bairro.id)}
      >
        {isExpanded ? <ChevronDown size={18} className="mr-2 text-text-dim shrink-0" /> : <ChevronRight size={18} className="mr-2 text-text-dim shrink-0" />}
        <MapPin size={18} className="mr-2 text-primary shrink-0" />
        <span className="truncate">{bairro.name}</span>
      </div>
      <div className="flex items-center space-x-1 md:space-x-2 ml-2">
        <button onClick={() => onAddTerritorio(bairro.id)} className="text-primary hover:text-blue-400 p-1" title="Adicionar Território">
          <Plus size={16} />
        </button>
        <button onClick={() => onEdit(bairro.id, bairro.name)} className="text-text-dim hover:text-text-main p-1" title="Editar Bairro">
          <Edit2 size={16} />
        </button>
        <button onClick={() => onDelete(bairro.id, bairro.name)} className="text-red-400 hover:text-red-300 p-1" title="Remover Bairro">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export const ManualEdit: React.FC = () => {
  const { db, addBairro, removeBairro, updateBairro, addTerritorio, removeTerritorio, updateTerritorio, addEndereco, removeEndereco, updateEndereco, markTerritorioAssigned, moveTerritorio } = useDatabase();
  const [expandedBairros, setExpandedBairros] = useState<Record<string, boolean>>({});
  const [expandedTerritorios, setExpandedTerritorios] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [formData, setFormData] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleBairro = (id: string) => setExpandedBairros(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTerritorio = (id: string) => setExpandedTerritorios(prev => ({ ...prev, [id]: !prev[id] }));

  const closeModal = () => {
    setModalState({ type: 'none' });
    setFormData({});
  };

  const handleCopyWhatsApp = (bairro: Bairro, territorio: Territorio) => {
    let msg = `📍 ${bairro.name.toUpperCase()} - TERRITÓRIO ${territorio.name.toUpperCase()}\n\n`;
    territorio.enderecos.forEach((end, index) => {
      msg += `${index + 1}. ${end.street}, ${end.number}\n`;
      if (end.observations) {
        msg += `- ${end.observations}\n`;
      }
    });
    msg += `\nDepois do trabalho, envie o relatório para o condutor.`;
    
    navigator.clipboard.writeText(msg);
    setCopiedId(territorio.id);
    markTerritorioAssigned(territorio.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = () => {
    switch (modalState.type) {
      case 'add_bairro':
        if (formData.name) addBairro(formData.name);
        break;
      case 'edit_bairro':
        if (formData.name) updateBairro(modalState.id, formData.name);
        break;
      case 'add_territorio':
        if (formData.name) addTerritorio(modalState.bairroId, formData.name);
        break;
      case 'edit_territorio':
        if (formData.name) {
          let isoDate = undefined;
          if (formData.lastAssignedDate) {
            isoDate = new Date(`${formData.lastAssignedDate}T12:00:00`).toISOString();
          } else if (formData.lastAssignedDate === '') {
            isoDate = '';
          }
          updateTerritorio(modalState.id, formData.name, isoDate);
        }
        break;
      case 'add_endereco':
        if (formData.street && formData.number) {
          const sDate = (formData.status || formData.statusComment) ? new Date().toISOString() : undefined;
          addEndereco(modalState.territorioId, formData.street, formData.number, formData.observations, formData.status, formData.statusComment, sDate);
        }
        break;
      case 'edit_endereco':
        if (formData.street && formData.number) {
          let sDate = formData.statusDate;
          const oldStatus = (modalState as any).status;
          const oldComment = (modalState as any).statusComment;
          if (formData.status !== oldStatus || formData.statusComment !== oldComment) {
            sDate = (formData.status || formData.statusComment) ? new Date().toISOString() : undefined;
          }
          if (!formData.status && !formData.statusComment) sDate = undefined;
          
          updateEndereco(modalState.id, formData.street, formData.number, formData.observations, formData.status, formData.statusComment, sDate);
        }
        break;
      case 'confirm_delete':
        if (modalState.entityType === 'bairro') removeBairro(modalState.id);
        else if (modalState.entityType === 'territorio') removeTerritorio(modalState.id);
        else if (modalState.entityType === 'endereco') removeEndereco(modalState.id);
        break;
    }
    closeModal();
  };

  const onDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    if (active.id !== over.id) {
      // Find if we're dropping over a territorio or a bairro header
      const overId = over.id;
      const territorioId = active.id;
      
      // If dropping over a bairro (checking if overId matches any bairro id)
      const targetBairro = db.bairros.find(b => b.id === overId);
      
      if (targetBairro) {
        moveTerritorio(territorioId, '', targetBairro.id);
      } else {
        moveTerritorio(territorioId, overId);
      }
    }
  };

  const suggestions: { bairro: Bairro, territorio: Territorio, days: number | null }[] = [];
  const today = new Date();
  
  db.bairros.forEach(bairro => {
    bairro.territorios.forEach(territorio => {
      if (!territorio.lastAssignedDate) {
        suggestions.push({ bairro, territorio, days: null });
      } else {
        const days = differenceInDays(today, new Date(territorio.lastAssignedDate));
        if (days > 20) {
          suggestions.push({ bairro, territorio, days });
        }
      }
    });
  });

  suggestions.sort((a, b) => {
    if (a.days === null && b.days === null) return 0;
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const activeTerritorio = activeId 
    ? db.bairros.flatMap(b => b.territorios).find(t => t.id === activeId)
    : null;
  const activeBairro = activeTerritorio 
    ? db.bairros.find(b => b.id === activeTerritorio.bairroId)
    : null;

  return (
    <div className="p-4 md:p-6 bg-bg h-full overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-semibold text-text-main flex items-center">
          <Map className="mr-2 text-primary" /> Banco de Dados
        </h2>
        <button 
          onClick={() => { setModalState({ type: 'add_bairro' }); setFormData({ name: '' }); }}
          className="w-full sm:w-auto justify-center bg-primary hover:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
        >
          <Plus size={16} className="mr-1" /> Novo Bairro
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6 bg-surface border border-border rounded-xl p-4">
          <h3 className="text-lg font-medium text-warning flex items-center mb-3">
            <AlertCircle size={18} className="mr-2" /> Sugestões de Visita
          </h3>
          <div className="flex overflow-x-auto pb-2 gap-3 snap-x">
            {suggestions.map((sug, idx) => (
              <div key={idx} className="shrink-0 w-64 bg-bg border border-border rounded-lg p-3 snap-start">
                <div className="font-medium text-text-main truncate">{sug.bairro.name}</div>
                <div className="text-sm text-text-dim truncate mb-2">Território {sug.territorio.name}</div>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-surface-accent text-warning">
                    {sug.days === null ? 'Nunca visitado' : `Há ${sug.days} dias`}
                  </span>
                  <button 
                    onClick={() => handleCopyWhatsApp(sug.bairro, sug.territorio)}
                    className="text-whatsapp hover:text-green-400 p-1"
                    title="Copiar mensagem para WhatsApp"
                  >
                    {copiedId === sug.territorio.id ? <Check size={16} /> : <MessageCircle size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {db.bairros.length === 0 ? (
        <div className="text-center py-10 text-text-dim">
          Nenhum bairro cadastrado. Adicione um para começar.
        </div>
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="space-y-4">
            {[...db.bairros].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(bairro => (
              <div key={bairro.id} className="border border-border rounded-lg overflow-hidden bg-surface">
                <BairroHeader 
                  bairro={bairro}
                  isExpanded={expandedBairros[bairro.id]}
                  onToggle={toggleBairro}
                  onAddTerritorio={(bId) => { setModalState({ type: 'add_territorio', bairroId: bId }); setFormData({ name: '' }); }}
                  onEdit={(id, name) => { setModalState({ type: 'edit_bairro', id, name }); setFormData({ name }); }}
                  onDelete={(id, name) => setModalState({ type: 'confirm_delete', entityType: 'bairro', id, name })}
                />

                {expandedBairros[bairro.id] && (
                  <div className="p-3 md:p-4 border-t border-border space-y-3">
                    {(() => {
                      const displayTerritorios = bairro.manualOrder 
                        ? bairro.territorios 
                        : [...bairro.territorios].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                      
                      return (
                        <SortableContext 
                          items={displayTerritorios.map(t => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {displayTerritorios.length === 0 ? (
                            <div className="text-sm text-text-dim pl-6 md:pl-8">Nenhum território neste bairro.</div>
                          ) : (
                            displayTerritorios.map(territorio => (
                              <SortableTerritorioItem 
                                key={territorio.id}
                                bairro={bairro}
                                territorio={territorio}
                                isExpanded={expandedTerritorios[territorio.id]}
                                onToggle={toggleTerritorio}
                                onAddEndereco={(tId) => { setModalState({ type: 'add_endereco', territorioId: tId }); setFormData({ street: '', number: '', observations: '' }); }}
                                onEdit={(t) => { 
                                  setModalState({ type: 'edit_territorio', id: t.id, name: t.name, lastAssignedDate: t.lastAssignedDate }); 
                                  setFormData({ 
                                    name: t.name, 
                                    lastAssignedDate: t.lastAssignedDate ? format(new Date(t.lastAssignedDate), 'yyyy-MM-dd') : '' 
                                  }); 
                                }}
                                onDelete={(id, name) => setModalState({ type: 'confirm_delete', entityType: 'territorio', id, name })}
                                onCopy={handleCopyWhatsApp}
                                onShare={async (b, t) => {
                                  const shareId = Math.random().toString(36).substring(2, 10);
                                  const origin = window.location.origin;
                                  const shareRef = doc(firestoreDb, 'shares', shareId);
                                  
                                  // For retrieving current auth
                                  const currentAuth = (await import('firebase/auth')).getAuth();
                                  if (!currentAuth.currentUser) {
                                    alert("Erro: Você precisa estar logado.");
                                    return;
                                  }

                                  try {
                                    await setDoc(shareRef, {
                                      id: shareId,
                                      ownerUid: currentAuth.currentUser.uid,
                                      bairroId: b.id,
                                      territorioId: t.id,
                                      bairroName: b.name,
                                      territorioName: t.name,
                                      enderecos: JSON.stringify(t.enderecos),
                                      createdAt: new Date()
                                    });
                                    setModalState({ type: 'share_link', url: `${origin}/?share=${shareId}` });
                                  } catch (err) {
                                    console.error("Failed to share", err);
                                    alert("Erro ao criar link. Verifique sua conexão.");
                                  }
                                }}
                                copiedId={copiedId}
                                onEditEndereco={(e) => {
                                  setModalState({ type: 'edit_endereco', id: e.id, street: e.street, number: e.number, observations: e.observations || '', status: e.status, statusComment: e.statusComment, statusDate: e.statusDate }); 
                                  setFormData({ street: e.street, number: e.number, observations: e.observations || '', status: e.status, statusComment: e.statusComment || '', statusDate: e.statusDate || '' }); 
                                }}
                                onDeleteEndereco={(id, name) => setModalState({ type: 'confirm_delete', entityType: 'endereco', id, name })}
                              />
                            ))
                          )}
                        </SortableContext>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeId && activeTerritorio && activeBairro ? (
              <div className="border border-primary bg-surface rounded-md shadow-xl opacity-90 scale-105">
                <div className="px-3 py-2 flex items-center text-sm">
                  <GripVertical size={14} className="text-primary mr-2" />
                  <Map size={14} className="mr-2 text-secondary shrink-0" />
                  <span className="font-medium">Território {activeTerritorio.name}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals */}
      <Modal 
        isOpen={modalState.type !== 'none'} 
        onClose={closeModal}
        title={
          modalState.type === 'add_bairro' ? 'Novo Bairro' :
          modalState.type === 'edit_bairro' ? 'Editar Bairro' :
          modalState.type === 'add_territorio' ? 'Novo Território' :
          modalState.type === 'edit_territorio' ? 'Editar Território' :
          modalState.type === 'add_endereco' ? 'Novo Endereço' :
          modalState.type === 'edit_endereco' ? 'Editar Endereço' :
          modalState.type === 'confirm_delete' ? 'Confirmar Exclusão' : 
          modalState.type === 'share_link' ? 'Link de Feedback Gerado' : ''
        }
      >
        <div className="space-y-4">
          {modalState.type === 'share_link' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-dim">
                Compartilhe o link abaixo com outra pessoa. Ela poderá adicionar observações em cada endereço sem precisar de uma conta.
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={modalState.url}
                  className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 outline-none text-sm font-mono overflow-x-auto"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(modalState.url);
                    alert("Link copiado para a área de transferência!");
                    closeModal();
                  }} 
                  className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Copiar e fechar
                </button>
              </div>
            </div>
          ) : modalState.type === 'confirm_delete' ? (
            <div>
              <p className="text-text-main">Tem certeza que deseja excluir <strong>{modalState.name}</strong>?</p>
              <p className="text-sm text-red-400 mt-2">Esta ação não pode ser desfeita.</p>
            </div>
          ) : (
            <>
              {(modalState.type === 'add_bairro' || modalState.type === 'edit_bairro') && (
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
              {(modalState.type === 'add_territorio' || modalState.type === 'edit_territorio') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-dim mb-1">Nome/Número do Território</label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ex: 6 ou Território 6"
                      autoFocus
                    />
                  </div>
                  {modalState.type === 'edit_territorio' && (
                    <div>
                      <label className="block text-sm font-medium text-text-dim mb-1">Data da Última Visita</label>
                      <input 
                        type="date" 
                        value={formData.lastAssignedDate || ''} 
                        onChange={e => setFormData({ ...formData, lastAssignedDate: e.target.value })}
                        className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      />
                      <p className="text-xs text-text-dim mt-1">Deixe em branco para marcar como nunca visitado.</p>
                    </div>
                  )}
                </div>
              )}
              {(modalState.type === 'add_endereco' || modalState.type === 'edit_endereco') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-dim mb-1">Rua</label>
                    <input 
                      type="text" 
                      value={formData.street || ''} 
                      onChange={e => setFormData({ ...formData, street: e.target.value })}
                      className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      autoFocus
                    />
                  </div>
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
                    <label className="block text-sm font-medium text-text-dim mb-1">Status (Opcional - Expira em 20 dias)</label>
                    <select
                      value={formData.status || ''}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    >
                      <option value="">Sem status</option>
                      <option value="Feito">Feito</option>
                      <option value="Não feito">Não feito</option>
                      <option value="Não existe">Não existe</option>
                      <option value="Não visitar">Não visitar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-dim mb-1">Comentário Público (Vinculado ao Status)</label>
                    <input 
                      type="text" 
                      value={formData.statusComment || ''} 
                      onChange={e => setFormData({ ...formData, statusComment: e.target.value })}
                      className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ex: Visitar de novo, Estudante"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-dim mb-1">Observações Privadas/Permanentes</label>
                    <input 
                      type="text" 
                      value={formData.observations || ''} 
                      onChange={e => setFormData({ ...formData, observations: e.target.value })}
                      className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                      placeholder="Ex: Cuidado com o cachorro"
                    />
                  </div>
                </>
              )}
            </>
          )}
          
          {modalState.type !== 'share_link' && (
            <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
              <button 
                onClick={closeModal}
                className="px-4 py-2 text-text-main bg-surface-accent hover:bg-border rounded-md font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className={`px-4 py-2 text-white rounded-md font-medium transition-colors ${
                  modalState.type === 'confirm_delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-blue-400'
                }`}
              >
                {modalState.type === 'confirm_delete' ? 'Excluir' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
