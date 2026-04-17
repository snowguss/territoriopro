import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Copy, Check, AlertCircle, Plus, MessageSquare, ChevronDown } from 'lucide-react';
import { useDatabase } from '../context/DatabaseContext';
import { cn } from '../lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ChatMessage, ChatSession } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  parts: [{ text: 'Olá! Sou seu assistente de territórios. Como posso ajudar você hoje?' }]
};

type ActionType = 'add' | 'edit' | 'remove' | 'suggest' | 'whatsapp' | 'find' | null;
type EntityType = 'bairro' | 'territorio' | 'endereco' | null;

type WizardStep = 
  | 'MAIN_MENU'
  | 'SELECT_ENTITY'
  | 'SELECT_BAIRRO'
  | 'SELECT_TERRITORIO'
  | 'SELECT_ENDERECO'
  | 'INPUT_BAIRRO_NAME'
  | 'INPUT_TERRITORIO_NAME'
  | 'INPUT_ENDERECO_STREET'
  | 'INPUT_ENDERECO_NUMBER'
  | 'INPUT_ENDERECO_OBS'
  | 'CONFIRM_REMOVE'
  | 'INPUT_EDIT_BAIRRO_NAME'
  | 'INPUT_EDIT_TERRITORIO_NAME'
  | 'INPUT_EDIT_ENDERECO_STREET'
  | 'INPUT_EDIT_ENDERECO_NUMBER'
  | 'INPUT_EDIT_ENDERECO_OBS'
  | 'SELECT_TERRITORIO_FOR_WHATSAPP'
  | 'INPUT_FIND_STREET';

interface WizardContext {
  action: ActionType;
  entity: EntityType;
  bairroId: string | null;
  territorioId: string | null;
  enderecoId: string | null;
  tempData: any;
}

const INITIAL_WIZARD_CONTEXT: WizardContext = {
  action: null,
  entity: null,
  bairroId: null,
  territorioId: null,
  enderecoId: null,
  tempData: {}
};

export const Chat: React.FC = () => {
  const { 
    db, getDb,
    addBairro, updateBairro, removeBairro, 
    addTerritorio, updateTerritorio, removeTerritorio, markTerritorioAssigned,
    addEndereco, updateEndereco, removeEndereco,
    saveChat, deleteChat
  } = useDatabase();
  
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    return localStorage.getItem('active_chat_id') || '';
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [wizardStep, setWizardStep] = useState<WizardStep>('MAIN_MENU');
  const [wizardCtx, setWizardCtx] = useState<WizardContext>(INITIAL_WIZARD_CONTEXT);

  // Load active chat or create new one
  useEffect(() => {
    const chats = db.chats || [];
    let currentChat = chats.find(c => c.id === activeChatId);
    
    if (!currentChat) {
      if (chats.length > 0) {
        currentChat = chats[0];
        setActiveChatId(currentChat.id);
        localStorage.setItem('active_chat_id', currentChat.id);
      } else {
        const newChat: ChatSession = {
          id: uuidv4(),
          title: 'Novo Chat',
          updatedAt: new Date().toISOString(),
          messages: [DEFAULT_WELCOME_MESSAGE]
        };
        saveChat(newChat);
        setActiveChatId(newChat.id);
        localStorage.setItem('active_chat_id', newChat.id);
        currentChat = newChat;
      }
    }
    setMessages(currentChat.messages);
  }, [activeChatId]);

  // Save messages to active chat when they change
  useEffect(() => {
    if (messages.length > 0 && activeChatId) {
      const chats = db.chats || [];
      const currentChat = chats.find(c => c.id === activeChatId);
      if (currentChat && currentChat.messages !== messages) {
        let title = currentChat.title;
        if (title === 'Novo Chat') {
          const firstUserMsg = messages.find(m => m.role === 'user');
          if (firstUserMsg && firstUserMsg.parts[0]?.text) {
            title = firstUserMsg.parts[0].text.substring(0, 30) + '...';
          }
        }
        
        saveChat({
          ...currentChat,
          title,
          updatedAt: new Date().toISOString(),
          messages
        });
      }
    }
    scrollToBottom();
  }, [messages, activeChatId]);

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: uuidv4(),
      title: 'Novo Chat',
      updatedAt: new Date().toISOString(),
      messages: [DEFAULT_WELCOME_MESSAGE]
    };
    saveChat(newChat);
    setActiveChatId(newChat.id);
    localStorage.setItem('active_chat_id', newChat.id);
    setIsHistoryOpen(false);
    resetWizard();
  };

  const switchChat = (id: string) => {
    setActiveChatId(id);
    localStorage.setItem('active_chat_id', id);
    setIsHistoryOpen(false);
    resetWizard();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addBotMessage = (text: string) => {
    const msg: ChatMessage = {
      id: uuidv4(),
      role: 'model',
      parts: [{ text }]
    };
    setMessages(prev => [...prev, msg]);
  };

  const addUserMessage = (text: string) => {
    const msg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      parts: [{ text }]
    };
    setMessages(prev => [...prev, msg]);
  };

  const resetWizard = () => {
    setWizardStep('MAIN_MENU');
    setWizardCtx(INITIAL_WIZARD_CONTEXT);
  };

  const cancelWizard = () => {
    addUserMessage('Cancelar');
    addBotMessage('Operação cancelada. Como posso ajudar?');
    resetWizard();
  };

  const goBack = () => {
    switch (wizardStep) {
      case 'SELECT_ENTITY':
        setWizardStep('MAIN_MENU');
        setWizardCtx({ ...wizardCtx, action: null });
        break;
      case 'SELECT_BAIRRO':
        if (wizardCtx.action === 'whatsapp') {
          setWizardStep('MAIN_MENU');
          setWizardCtx({ ...wizardCtx, action: null });
        } else {
          setWizardStep('SELECT_ENTITY');
          setWizardCtx({ ...wizardCtx, entity: null });
        }
        break;
      case 'SELECT_TERRITORIO':
      case 'SELECT_TERRITORIO_FOR_WHATSAPP':
        setWizardStep('SELECT_BAIRRO');
        setWizardCtx({ ...wizardCtx, bairroId: null });
        break;
      case 'INPUT_FIND_STREET':
        setWizardStep('MAIN_MENU');
        setWizardCtx({ ...wizardCtx, action: null });
        break;
      case 'SELECT_ENDERECO':
        setWizardStep('SELECT_TERRITORIO');
        setWizardCtx({ ...wizardCtx, territorioId: null });
        break;
      case 'INPUT_BAIRRO_NAME':
        setWizardStep('SELECT_ENTITY');
        break;
      case 'INPUT_TERRITORIO_NAME':
        setWizardStep('SELECT_BAIRRO');
        break;
      case 'INPUT_ENDERECO_STREET':
        if (wizardCtx.action === 'add') {
          setWizardStep('SELECT_TERRITORIO');
        }
        break;
      case 'INPUT_ENDERECO_NUMBER':
        setWizardStep('INPUT_ENDERECO_STREET');
        break;
      case 'INPUT_ENDERECO_OBS':
        setWizardStep('INPUT_ENDERECO_NUMBER');
        break;
      case 'CONFIRM_REMOVE':
        if (wizardCtx.entity === 'bairro') setWizardStep('SELECT_BAIRRO');
        else if (wizardCtx.entity === 'territorio') setWizardStep('SELECT_TERRITORIO');
        else if (wizardCtx.entity === 'endereco') setWizardStep('SELECT_ENDERECO');
        break;
      case 'INPUT_EDIT_BAIRRO_NAME':
        setWizardStep('SELECT_BAIRRO');
        break;
      case 'INPUT_EDIT_TERRITORIO_NAME':
        setWizardStep('SELECT_TERRITORIO');
        break;
      case 'INPUT_EDIT_ENDERECO_STREET':
        setWizardStep('SELECT_ENDERECO');
        break;
      case 'INPUT_EDIT_ENDERECO_NUMBER':
        setWizardStep('INPUT_EDIT_ENDERECO_STREET');
        break;
      case 'INPUT_EDIT_ENDERECO_OBS':
        setWizardStep('INPUT_EDIT_ENDERECO_NUMBER');
        break;
    }
  };

  const handleOption = (action: ActionType, label: string) => {
    addUserMessage(label);
    setWizardCtx({ ...wizardCtx, action });
    
    if (action === 'suggest') {
      handleSuggest();
    } else if (action === 'whatsapp') {
      setWizardStep('SELECT_BAIRRO');
      addBotMessage('Selecione o bairro do território:');
    } else if (action === 'find') {
      setWizardStep('INPUT_FIND_STREET');
      addBotMessage('Digite o nome da rua para eu procurar em quais territórios ela já existe:');
    } else {
      setWizardStep('SELECT_ENTITY');
      addBotMessage(`O que você deseja ${label.toLowerCase()}?`);
    }
  };

  const handleEntityOption = (entity: EntityType, label: string) => {
    addUserMessage(label);
    setWizardCtx({ ...wizardCtx, entity });

    if (wizardCtx.action === 'add') {
      if (entity === 'bairro') {
        setWizardStep('INPUT_BAIRRO_NAME');
        addBotMessage('Digite o nome do novo bairro:');
      } else {
        setWizardStep('SELECT_BAIRRO');
        addBotMessage('Selecione o bairro:');
      }
    } else if (wizardCtx.action === 'edit' || wizardCtx.action === 'remove') {
      setWizardStep('SELECT_BAIRRO');
      addBotMessage('Selecione o bairro:');
    }
  };

  const handleBairroSelect = (id: string, name: string) => {
    addUserMessage(name);
    setWizardCtx({ ...wizardCtx, bairroId: id });

    if (wizardCtx.action === 'whatsapp') {
      setWizardStep('SELECT_TERRITORIO_FOR_WHATSAPP');
      addBotMessage('Selecione o território:');
      return;
    }

    if (wizardCtx.entity === 'bairro') {
      if (wizardCtx.action === 'edit') {
        setWizardStep('INPUT_EDIT_BAIRRO_NAME');
        addBotMessage(`Digite o novo nome para o bairro "${name}":`);
      } else if (wizardCtx.action === 'remove') {
        setWizardStep('CONFIRM_REMOVE');
        addBotMessage(`Tem certeza que deseja remover o bairro "${name}" e todos os seus territórios?`);
      }
    } else {
      setWizardStep('SELECT_TERRITORIO');
      addBotMessage('Selecione o território:');
    }
  };

  const handleTerritorioSelect = (id: string, name: string) => {
    addUserMessage(name);
    setWizardCtx({ ...wizardCtx, territorioId: id });

    if (wizardCtx.action === 'whatsapp') {
      handleGenerateWhatsapp(id);
      return;
    }

    if (wizardCtx.entity === 'territorio') {
      if (wizardCtx.action === 'add') {
        // Should not happen, add territorio goes from SELECT_BAIRRO to INPUT_TERRITORIO_NAME
      } else if (wizardCtx.action === 'edit') {
        setWizardStep('INPUT_EDIT_TERRITORIO_NAME');
        addBotMessage(`Digite o novo nome para o território "${name}":`);
      } else if (wizardCtx.action === 'remove') {
        setWizardStep('CONFIRM_REMOVE');
        addBotMessage(`Tem certeza que deseja remover o território "${name}"?`);
      }
    } else if (wizardCtx.entity === 'endereco') {
      if (wizardCtx.action === 'add') {
        setWizardStep('INPUT_ENDERECO_STREET');
        addBotMessage('Digite o nome da rua:');
      } else {
        setWizardStep('SELECT_ENDERECO');
        addBotMessage('Selecione o endereço:');
      }
    }
  };

  const handleEnderecoSelect = (id: string, label: string) => {
    addUserMessage(label);
    setWizardCtx({ ...wizardCtx, enderecoId: id });

    if (wizardCtx.action === 'edit') {
      setWizardStep('INPUT_EDIT_ENDERECO_STREET');
      addBotMessage('Digite o novo nome da rua:');
    } else if (wizardCtx.action === 'remove') {
      setWizardStep('CONFIRM_REMOVE');
      addBotMessage(`Tem certeza que deseja remover este endereço?`);
    }
  };

  const handleConfirmRemove = (confirm: boolean) => {
    addUserMessage(confirm ? 'Sim' : 'Não');
    if (confirm) {
      if (wizardCtx.entity === 'bairro') {
        removeBairro(wizardCtx.bairroId!);
        addBotMessage('Bairro removido com sucesso!');
      } else if (wizardCtx.entity === 'territorio') {
        removeTerritorio(wizardCtx.territorioId!);
        addBotMessage('Território removido com sucesso!');
      } else if (wizardCtx.entity === 'endereco') {
        removeEndereco(wizardCtx.enderecoId!);
        addBotMessage('Endereço removido com sucesso!');
      }
    } else {
      addBotMessage('Operação cancelada.');
    }
    resetWizard();
  };

  const handleTextInput = () => {
    const text = input.trim();
    if (!text && wizardStep !== 'INPUT_ENDERECO_OBS' && wizardStep !== 'INPUT_EDIT_ENDERECO_OBS') return;
    
    addUserMessage(text || '(vazio)');
    setInput('');

    switch (wizardStep) {
      case 'INPUT_BAIRRO_NAME':
        addBairro(text);
        addBotMessage(`Bairro "${text}" adicionado com sucesso!`);
        resetWizard();
        break;
      case 'INPUT_TERRITORIO_NAME':
        addTerritorio(wizardCtx.bairroId!, text);
        addBotMessage(`Território "${text}" adicionado com sucesso!`);
        resetWizard();
        break;
      case 'INPUT_ENDERECO_STREET':
        setWizardCtx({ ...wizardCtx, tempData: { street: text } });
        setWizardStep('INPUT_ENDERECO_NUMBER');
        addBotMessage('Digite o número:');
        break;
      case 'INPUT_ENDERECO_NUMBER':
        setWizardCtx({ ...wizardCtx, tempData: { ...wizardCtx.tempData, number: text } });
        setWizardStep('INPUT_ENDERECO_OBS');
        addBotMessage('Digite as observações (ou deixe em branco e aperte Enter):');
        break;
      case 'INPUT_ENDERECO_OBS':
        addEndereco(wizardCtx.territorioId!, wizardCtx.tempData.street, wizardCtx.tempData.number, text);
        addBotMessage('Endereço adicionado com sucesso!');
        resetWizard();
        break;
      
      // EDIT
      case 'INPUT_EDIT_BAIRRO_NAME':
        updateBairro(wizardCtx.bairroId!, text);
        addBotMessage(`Bairro renomeado para "${text}"!`);
        resetWizard();
        break;
      case 'INPUT_EDIT_TERRITORIO_NAME':
        updateTerritorio(wizardCtx.territorioId!, text);
        addBotMessage(`Território renomeado para "${text}"!`);
        resetWizard();
        break;
      case 'INPUT_EDIT_ENDERECO_STREET':
        setWizardCtx({ ...wizardCtx, tempData: { street: text } });
        setWizardStep('INPUT_EDIT_ENDERECO_NUMBER');
        addBotMessage('Digite o novo número:');
        break;
      case 'INPUT_EDIT_ENDERECO_NUMBER':
        setWizardCtx({ ...wizardCtx, tempData: { ...wizardCtx.tempData, number: text } });
        setWizardStep('INPUT_EDIT_ENDERECO_OBS');
        addBotMessage('Digite as novas observações (ou deixe em branco e aperte Enter):');
        break;
      case 'INPUT_EDIT_ENDERECO_OBS':
        updateEndereco(wizardCtx.enderecoId!, wizardCtx.tempData.street, wizardCtx.tempData.number, text);
        addBotMessage('Endereço atualizado com sucesso!');
        resetWizard();
        break;
      case 'INPUT_FIND_STREET':
        handleFindStreet(text);
        break;
    }
  };

  const handleFindStreet = (streetName: string) => {
    const results: { bairro: string, territorio: string, id: string }[] = [];
    const search = streetName.toLowerCase().trim();

    getDb().bairros.forEach(bairro => {
      bairro.territorios.forEach(territorio => {
        const hasStreet = territorio.enderecos.some(e => e.street.toLowerCase().includes(search));
        if (hasStreet) {
          results.push({ bairro: bairro.name, territorio: territorio.name, id: territorio.id });
        }
      });
    });

    if (results.length === 0) {
      addBotMessage(`Não encontrei a rua "${streetName}" em nenhum território existente. Você pode adicioná-la em um novo território se desejar.`);
    } else {
      let msg = `Encontrei a rua "${streetName}" nos seguintes locais:\n\n`;
      results.forEach(r => {
        msg += `• ${r.bairro} - Território ${r.territorio}\n`;
      });
      msg += `\nIsso ajuda a decidir onde colocar o novo endereço?`;
      addBotMessage(msg);
    }
    resetWizard();
  };

  const handleSuggest = () => {
    const suggestions: any[] = [];
    const now = new Date();
    getDb().bairros.forEach(bairro => {
      bairro.territorios.forEach(t => {
        if (!t.lastAssignedDate) {
          suggestions.push({ bairro: bairro.name, territorio: t.name, status: 'Nunca visitado', id: t.id });
        } else {
          const days = differenceInDays(now, new Date(t.lastAssignedDate));
          if (days >= 20) {
            suggestions.push({ bairro: bairro.name, territorio: t.name, status: `Não visitado há ${days} dias`, id: t.id });
          }
        }
      });
    });

    if (suggestions.length === 0) {
      addBotMessage('Não há territórios atrasados no momento. Ótimo trabalho!');
    } else {
      let msg = 'Aqui estão algumas sugestões de territórios para visitar:\n\n';
      suggestions.forEach(s => {
        msg += `- ${s.bairro}, Território ${s.territorio} (${s.status})\n`;
      });
      addBotMessage(msg);
    }
    resetWizard();
  };

  const handleGenerateWhatsapp = (territorioId: string) => {
    let message = '';
    getDb().bairros.forEach(bairro => {
      const territorio = bairro.territorios.find(t => t.id === territorioId);
      if (territorio) {
        message += `📍 ${bairro.name.toUpperCase()} - TERRITÓRIO ${territorio.name.toUpperCase()}\n\n`;
        territorio.enderecos.forEach((end, index) => {
          message += `${index + 1}. ${end.street}, ${end.number}\n`;
          if (end.observations) {
            message += `- ${end.observations}\n`;
          }
        });
        message += `\nDepois do trabalho, envie o relatório para o condutor.`;
      }
    });
    
    if (!message) {
      addBotMessage('Território não encontrado.');
    } else {
      addBotMessage('Aqui está a mensagem gerada:\n\n' + message);
    }
    resetWizard();
  };

  const overdueCount = db.bairros.reduce((acc, bairro) => {
    return acc + bairro.territorios.filter(t => {
      if (!t.lastAssignedDate) return true;
      return differenceInDays(new Date(), new Date(t.lastAssignedDate)) >= 20;
    }).length;
  }, 0);

  const activeChat = (db.chats || []).find(c => c.id === activeChatId);

  const renderOptions = () => {
    switch (wizardStep) {
      case 'MAIN_MENU':
        return (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleOption('add', 'Adicionar')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Adicionar</button>
            <button onClick={() => handleOption('edit', 'Editar')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Editar</button>
            <button onClick={() => handleOption('remove', 'Remover')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Remover</button>
            <button onClick={() => handleOption('suggest', 'Sugerir Territórios')} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Sugerir Territórios</button>
            <button onClick={() => handleOption('find', 'Localizar Rua')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Localizar Rua</button>
            <button onClick={() => handleOption('whatsapp', 'Gerar Mensagem WhatsApp')} className="bg-whatsapp/20 text-whatsapp hover:bg-whatsapp/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Gerar Mensagem WhatsApp</button>
          </div>
        );
      case 'SELECT_ENTITY':
        return (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleEntityOption('bairro', 'Bairro')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Bairro</button>
            <button onClick={() => handleEntityOption('territorio', 'Território')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Território</button>
            <button onClick={() => handleEntityOption('endereco', 'Endereço')} className="bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Endereço</button>
            <button onClick={goBack} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Voltar</button>
            <button onClick={cancelWizard} className="bg-error/20 text-error hover:bg-error/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          </div>
        );
      case 'SELECT_BAIRRO':
        return (
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {getDb().bairros.map(b => (
              <button key={b.id} onClick={() => handleBairroSelect(b.id, b.name)} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">{b.name}</button>
            ))}
            {getDb().bairros.length === 0 && <span className="text-sm text-text-dim py-1.5">Nenhum bairro encontrado.</span>}
            <button onClick={goBack} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Voltar</button>
            <button onClick={cancelWizard} className="bg-error/20 text-error hover:bg-error/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          </div>
        );
      case 'SELECT_TERRITORIO':
      case 'SELECT_TERRITORIO_FOR_WHATSAPP':
        const bairro = getDb().bairros.find(b => b.id === wizardCtx.bairroId);
        return (
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {bairro?.territorios.map(t => (
              <button key={t.id} onClick={() => handleTerritorioSelect(t.id, t.name)} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">{t.name}</button>
            ))}
            {(!bairro || bairro.territorios.length === 0) && <span className="text-sm text-text-dim py-1.5">Nenhum território encontrado.</span>}
            <button onClick={goBack} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Voltar</button>
            <button onClick={cancelWizard} className="bg-error/20 text-error hover:bg-error/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          </div>
        );
      case 'SELECT_ENDERECO':
        const b = getDb().bairros.find(b => b.id === wizardCtx.bairroId);
        const t = b?.territorios.find(t => t.id === wizardCtx.territorioId);
        return (
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {t?.enderecos.map(e => (
              <button key={e.id} onClick={() => handleEnderecoSelect(e.id, `${e.street}, ${e.number}`)} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-left max-w-full truncate">
                {e.street}, {e.number}
              </button>
            ))}
            {(!t || t.enderecos.length === 0) && <span className="text-sm text-text-dim py-1.5">Nenhum endereço encontrado.</span>}
            <button onClick={goBack} className="bg-surface-accent text-text-main hover:bg-border px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Voltar</button>
            <button onClick={cancelWizard} className="bg-error/20 text-error hover:bg-error/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          </div>
        );
      case 'CONFIRM_REMOVE':
        return (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleConfirmRemove(true)} className="bg-error/20 text-error hover:bg-error/30 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">Sim, remover</button>
            <button onClick={() => handleConfirmRemove(false)} className="bg-surface-accent text-text-main hover:bg-border px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">Não, cancelar</button>
            <button onClick={goBack} className="bg-surface-accent text-text-main hover:bg-border px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">Voltar</button>
          </div>
        );
      default:
        return null;
    }
  };

  const needsTextInput = [
    'INPUT_BAIRRO_NAME', 'INPUT_TERRITORIO_NAME', 
    'INPUT_ENDERECO_STREET', 'INPUT_ENDERECO_NUMBER', 'INPUT_ENDERECO_OBS',
    'INPUT_EDIT_BAIRRO_NAME', 'INPUT_EDIT_TERRITORIO_NAME', 
    'INPUT_EDIT_ENDERECO_STREET', 'INPUT_EDIT_ENDERECO_NUMBER', 'INPUT_EDIT_ENDERECO_OBS',
    'INPUT_FIND_STREET'
  ].includes(wizardStep);

  return (
    <div className="flex flex-col h-full w-full bg-bg relative">
      {/* Header */}
      <div className="h-14 md:h-16 px-4 md:px-6 flex items-center justify-between border-b border-border shrink-0 z-10 bg-bg">
        <div className="relative">
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center gap-2 font-semibold text-text-main hover:text-primary transition-colors"
          >
            <MessageSquare size={18} className="text-primary" />
            <span className="truncate max-w-[150px] md:max-w-[300px]">{activeChat?.title || 'Assistente'}</span>
            <ChevronDown size={16} className={cn("transition-transform", isHistoryOpen && "rotate-180")} />
          </button>

          {/* Chat History Dropdown */}
          {isHistoryOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-20">
              <div className="p-2 border-b border-border">
                <button 
                  onClick={createNewChat}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus size={16} /> Novo Chat
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                {(db.chats || []).map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => switchChat(chat.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors",
                      chat.id === activeChatId 
                        ? "bg-surface-accent text-text-main font-medium" 
                        : "text-text-dim hover:bg-surface-accent hover:text-text-main"
                    )}
                  >
                    {chat.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="text-xs text-secondary flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          Online
        </div>
      </div>

      {/* Click away listener for dropdown */}
      {isHistoryOpen && (
        <div 
          className="absolute inset-0 z-0 bg-transparent" 
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full group",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[90%] md:max-w-[80%] px-3 py-2.5 md:px-4 md:py-3 rounded-xl text-sm leading-relaxed relative",
              msg.role === 'user' 
                ? "bg-primary text-white rounded-br-sm" 
                : "bg-surface text-text-main border border-border rounded-bl-sm"
            )}>
              <div className="whitespace-pre-wrap break-words">
                {msg.parts.map((p, i) => p.text ? <span key={i}>{p.text}</span> : null)}
              </div>
              {msg.role === 'model' && msg.parts.some(p => p.text) && (
                <button
                  onClick={() => handleCopy(msg.parts.map(p => p.text).join(''), msg.id)}
                  className="absolute top-2 right-2 p-1.5 text-text-dim hover:text-text-main bg-surface-accent hover:bg-border rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copiar mensagem"
                >
                  {copiedId === msg.id ? <Check size={14} className="text-whatsapp" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 md:p-5 bg-surface border-t border-border shrink-0 flex flex-col gap-3">
        {!needsTextInput && renderOptions()}
        
        {needsTextInput && (
          <div className="flex items-center gap-2">
            <div className="bg-bg border border-border rounded-xl px-4 py-3 flex items-center flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextInput()}
                placeholder="Digite aqui..."
                className="flex-1 bg-transparent border-none text-white outline-none text-sm placeholder:text-text-dim"
                autoFocus
              />
              <button
                onClick={handleTextInput}
                className="text-primary hover:text-white transition-colors ml-2"
              >
                <Send size={20} />
              </button>
            </div>
            <button onClick={goBack} className="bg-surface-accent text-text-main hover:bg-border px-4 py-3 rounded-xl text-sm font-medium transition-colors">
              Voltar
            </button>
            <button onClick={cancelWizard} className="bg-error/20 text-error hover:bg-error/30 px-4 py-3 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
