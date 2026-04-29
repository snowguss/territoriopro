import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, MapPin, Home, Map, MessageCircle, Check, AlertCircle, GripVertical, Share2, Link, MessageSquarePlus, RotateCcw, Info } from 'lucide-react';
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
  | { type: 'smart_add_endereco' }
  | { type: 'preview_territorio', bairro: Bairro, territorio: Territorio }
  | { type: 'edit_endereco', id: string, street: string, number: string, observations: string, status?: string, statusComment?: string, statusDate?: string }
  | { type: 'confirm_reset_statuses', id: string, name: string }
  | { type: 'confirm_delete', entityType: 'bairro' | 'territorio' | 'endereco', id: string, name: string };

interface SortableTerritorioProps {
  bairro: Bairro;
  territorio: Territorio;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onAddEndereco: (territorioId: string) => void;
  onEdit: (territorio: Territorio) => void;
  onDelete: (id: string, name: string) => void;
  onCopy: (bairro: Bairro, territorio: Territorio) => void;
  onResetStatuses: (id: string, name: string) => void;
  copiedId: string | null;
  onEditEndereco: (endereco: Endereco) => void;
  onDeleteEndereco: (id: string, name: string) => void;
}

const SortableTerritorioItem: React.FC<SortableTerritorioProps> = ({ 
  bairro, territorio, isExpanded, onToggle, onAddEndereco, onEdit, onDelete, onCopy, onResetStatuses, copiedId, onEditEndereco, onDeleteEndereco 
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
            onClick={() => onCopy(bairro, territorio)} 
            className="text-whatsapp hover:text-green-400 p-1 mr-1" 
            title="Copiar mensagem com Link para WhatsApp"
          >
            {copiedId === territorio.id ? <Check size={14} /> : <MessageCircle size={14} />}
          </button>
          <button onClick={() => onAddEndereco(territorio.id)} className="text-primary hover:text-blue-400 p-1" title="Adicionar Endereço">
            <Plus size={14} />
          </button>
          <button onClick={() => onResetStatuses(territorio.id, `Território ${territorio.name}`)} className="text-warning hover:text-yellow-600 p-1" title="Resetar Todos os Status do Território">
            <RotateCcw size={14} />
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
  const { db, addBairro, removeBairro, updateBairro, addTerritorio, removeTerritorio, updateTerritorio, addEndereco, removeEndereco, updateEndereco, markTerritorioAssigned, moveTerritorio, resetTerritorioStatuses } = useDatabase();
  const [expandedBairros, setExpandedBairros] = useState<Record<string, boolean>>({});
  const [expandedTerritorios, setExpandedTerritorios] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showMatches, setShowMatches] = useState(false);

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
              matches.push({
                street: e.street,
                defaultBairroId: b.id,
                defaultTerritorioId: t.id,
                bairroName: b.name,
                territorioName: t.name
              });
            }
          }
        });
      });
    });
    return matches.slice(0, 5); // Limit suggestions
  }, [formData.street, db, modalState.type]);

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

      await setDoc(shareRef, {
        id: shareId,
        ownerUid: currentAuth.currentUser.uid,
        bairroId: bairro.id,
        territorioId: territorio.id,
        bairroName: bairro.name,
        territorioName: territorio.name,
        enderecos: JSON.stringify(territorio.enderecos),
        createdAt: new Date()
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
      
      const shareUrl = `${origin}/?share=${shareId}`;

      let msg = `📍 ${bairro.name.toUpperCase()} - TERRITÓRIO ${territorio.name.toUpperCase()}\n\n`;
      territorio.enderecos.forEach((end, index) => {
        msg += `${index + 1}. ${end.street}, ${end.number}\n`;
        if (end.observations) {
          msg += `- ${end.observations}\n`;
        }
      });
      msg += `\nDepois do trabalho, envie o relatório clicando no link abaixo:\n${shareUrl}`;
      
      await navigator.clipboard.writeText(msg);
      setCopiedId(territorio.id);
      markTerritorioAssigned(territorio.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error(error);
      alert("Erro ao copiar e gerar link.");
    }
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
      case 'smart_add_endereco':
        if (formData.street && formData.number && formData.selectedTerritorioId) {
          const sDate = (formData.status || formData.statusComment) ? new Date().toISOString() : undefined;
          addEndereco(formData.selectedTerritorioId, formData.street, formData.number, formData.observations, formData.status, formData.statusComment, sDate);
        } else {
          alert('Preencha a rua, número e selecione Bairro/Território para salvar.');
          return; // Prevents closeModal from running so they can fix it
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
      case 'confirm_reset_statuses':
        resetTerritorioStatuses(modalState.id);
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

  const totalAddresses = db.bairros.reduce((acc, bairro) => 
    acc + bairro.territorios.reduce((tAcc, territorio) => 
      tAcc + (territorio.enderecos?.length || 0), 0), 0);

  return (
    <div className="p-4 md:p-6 bg-bg h-full overflow-y-auto w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 md:mb-6 gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-semibold text-text-main flex items-center">
          <Map className="mr-2 text-primary" /> Banco de Dados
          <span className="ml-3 px-2 py-0.5 bg-surface-accent text-text-dim text-sm rounded-full font-medium">
            {totalAddresses} endereços
          </span>
        </h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => { setModalState({ type: 'smart_add_endereco' }); setFormData({ street: '', number: '', observations: '', selectedBairroId: '', selectedTerritorioId: '' }); setShowMatches(true); }}
            className="flex-1 sm:flex-none justify-center bg-secondary hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors"
          >
            <Home size={16} className="mr-2" /> Endereço
          </button>
          <button 
            onClick={() => { setModalState({ type: 'add_bairro' }); setFormData({ name: '' }); }}
            className="flex-1 sm:flex-none justify-center bg-primary hover:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors"
          >
            <Plus size={16} className="mr-1" /> Bairro
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6 bg-surface border border-border rounded-xl p-4">
          <h3 className="text-lg font-medium text-warning flex items-center mb-3">
            <AlertCircle size={18} className="mr-2" /> Sugestões de Visita
          </h3>
          <div className="flex overflow-x-auto pb-2 gap-3 snap-x">
            {suggestions.map((sug, idx) => (
              <button 
                key={idx} 
                onClick={() => { setModalState({ type: 'preview_territorio', bairro: sug.bairro, territorio: sug.territorio }); }}
                className="shrink-0 w-64 bg-bg border border-border rounded-lg p-3 snap-start hover:border-primary/30 transition-colors text-left flex flex-col"
              >
                <div className="font-medium text-text-main truncate w-full">{sug.bairro.name}</div>
                <div className="text-sm text-text-dim truncate mb-2 w-full">Território {sug.territorio.name}</div>
                <div className="flex items-center justify-between mt-auto w-full">
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-surface-accent text-warning">
                    {sug.days === null ? 'Nunca visitado' : `Há ${sug.days} dias`}
                  </span>
                </div>
              </button>
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
                                onResetStatuses={(id, name) => setModalState({ type: 'confirm_reset_statuses', id, name })}
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
          (modalState.type === 'add_endereco' || modalState.type === 'smart_add_endereco') ? 'Adicionar Endereço Rápido' :
          modalState.type === 'edit_endereco' ? 'Editar Endereço' :
          modalState.type === 'confirm_reset_statuses' ? 'Resetar Status' :
          modalState.type === 'preview_territorio' ? 'Visualizar Território' :
          modalState.type === 'confirm_delete' ? 'Confirmar Exclusão' : ''
        }
      >
        <div className="space-y-4">
          {modalState.type === 'confirm_delete' ? (
            <div>
              <p className="text-text-main">Tem certeza que deseja excluir <strong>{modalState.name}</strong>?</p>
              <p className="text-sm text-red-400 mt-2">Esta ação não pode ser desfeita.</p>
            </div>
          ) : modalState.type === 'confirm_reset_statuses' ? (
            <div>
              <p className="text-text-main">Tem certeza que deseja limpar todos os status e comentários vinculados do <strong>{modalState.name}</strong>?</p>
              <p className="text-sm text-warning mt-2">Isso apagará o status "Feito", "Não feito", etc. das casas, juntamente com o comentário de status (as observações permanentes ficarão intactas).</p>
            </div>
          ) : modalState.type === 'preview_territorio' && modalState.bairro && modalState.territorio ? (
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
                onClick={() => handleCopyWhatsApp(modalState.bairro as any, modalState.territorio as any)}
                className="w-full bg-whatsapp text-white py-3 rounded-xl font-medium shadow-sm hover:bg-green-500 flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle size={18} /> Copiar P/ WhatsApp
              </button>
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
              {(modalState.type === 'add_endereco' || modalState.type === 'edit_endereco' || modalState.type === 'smart_add_endereco') && (
                <>
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

                      {/* Dropdowns for Bairro and Territorio */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-text-dim mb-1">Bairro</label>
                          <select 
                            value={formData.selectedBairroId || ''} 
                            onChange={e => setFormData({ ...formData, selectedBairroId: e.target.value, selectedTerritorioId: '' })}
                            className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 outline-none"
                          >
                            <option value="" disabled>Selecione ou busque na tabela...</option>
                            {db.bairros.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
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
                              
                              const uniqStreets = Array.from(new Set(t.enderecos.map(e => e.street)));
                              return uniqStreets.join(', ');
                            })()}
                          </div>
                        </div>
                      )}
                      
                      <hr className="border-border/50" />
                    </div>
                  )}

                  {modalState.type !== 'smart_add_endereco' && (
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
                  )}
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
          
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-border mt-4">
            <button 
              onClick={closeModal}
              className="px-4 py-2 text-text-main bg-surface-accent hover:bg-border rounded-md font-medium transition-colors"
            >
              {modalState.type === 'preview_territorio' ? 'Fechar' : 'Cancelar'}
            </button>
            {modalState.type !== 'preview_territorio' && (
              <button 
                onClick={handleSave}
                className={`px-4 py-2 text-white rounded-md font-medium transition-colors ${
                  modalState.type === 'confirm_delete' ? 'bg-red-500 hover:bg-red-600' : 
                  modalState.type === 'confirm_reset_statuses' ? 'bg-warning hover:bg-yellow-600' : 
                  'bg-primary hover:bg-blue-400'
                }`}
              >
                {modalState.type === 'confirm_delete' ? 'Excluir' : 
                 modalState.type === 'confirm_reset_statuses' ? 'Limpar Status' : 
                 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
