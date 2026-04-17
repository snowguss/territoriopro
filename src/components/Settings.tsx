import React, { useRef, useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Download, Upload, Settings as SettingsIcon, AlertCircle, CheckCircle2, Sparkles, Loader2, MapPin } from 'lucide-react';

export const Settings: React.FC = () => {
  const { db, exportDb, importDb, importState, startBulkImport, updateSettings, clearDatabase } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  const [bulkText, setBulkText] = useState('');
  const [city, setCity] = useState(db.city || '');
  const [state, setState] = useState(db.state || '');

  const handleSaveLocation = () => {
    updateSettings(city, state);
    setStatus({ type: 'success', message: 'Localização salva com sucesso!' });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleDeleteAll = () => {
    if (deleteConfirmText.toUpperCase() === 'EXCLUIR') {
      clearDatabase();
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setStatus({ type: 'success', message: 'Toda a base de dados foi apagada.' });
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ type: 'error', message: 'Palavra de confirmação incorreta.' });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleExport = () => {
    const json = exportDb();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `territorios_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus({ type: 'success', message: 'Backup exportado com sucesso!' });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDb(content);
        if (success) {
          setStatus({ type: 'success', message: 'Banco de dados importado com sucesso!' });
        } else {
          setStatus({ type: 'error', message: 'Erro ao importar. O arquivo pode estar corrompido ou em formato inválido.' });
        }
        setTimeout(() => setStatus(null), 5000);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBulkImport = () => {
    if (!bulkText.trim()) return;
    startBulkImport(bulkText);
    setBulkText('');
  };

  return (
    <div className="p-4 md:p-6 bg-bg h-full w-full overflow-y-auto">
      <h2 className="text-xl md:text-2xl font-semibold text-text-main flex items-center mb-4 md:mb-6">
        <SettingsIcon className="mr-2 text-primary" /> Configurações
      </h2>

      {status && (
        <div className={`mb-6 p-4 rounded-md flex items-center border ${status.type === 'success' ? 'bg-surface-accent text-whatsapp border-whatsapp/30' : 'bg-surface-accent text-red-400 border-red-400/30'}`}>
          {status.type === 'success' ? <CheckCircle2 className="mr-2 shrink-0" size={20} /> : <AlertCircle className="mr-2 shrink-0" size={20} />}
          <span className="text-sm md:text-base">{status.message}</span>
        </div>
      )}

      <div className="space-y-6 max-w-xl">
        {/* Location Settings */}
        <div className="bg-surface p-4 md:p-5 rounded-xl border border-border">
          <h3 className="text-lg font-medium text-text-main mb-2 flex items-center">
            <MapPin className="mr-2 text-primary" size={20} />
            Localização Base
          </h3>
          <p className="text-sm text-text-dim mb-4">
            Defina sua cidade e estado. Isso ajuda a Inteligência Artificial a encontrar o território correto quando você pedir para adicionar um endereço apenas pelo nome da rua.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-dim mb-1">Cidade</label>
              <input 
                type="text" 
                value={city} 
                onChange={e => setCity(e.target.value)}
                placeholder="Ex: Palhoça"
                className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <div className="w-full sm:w-24">
              <label className="block text-sm font-medium text-text-dim mb-1">UF</label>
              <input 
                type="text" 
                value={state} 
                onChange={e => setState(e.target.value)}
                placeholder="Ex: SC"
                maxLength={2}
                className="w-full bg-bg border border-border text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none uppercase"
              />
            </div>
          </div>
          <button
            onClick={handleSaveLocation}
            className="w-full sm:w-auto flex items-center justify-center bg-surface-accent border border-border hover:bg-border text-text-main px-4 py-2 rounded-md font-medium transition-colors"
          >
            Salvar Localização
          </button>
        </div>

        {/* Bulk Import Section */}
        <div className="bg-surface p-4 md:p-5 rounded-xl border border-border">
          <h3 className="text-lg font-medium text-text-main mb-2 flex items-center">
            <Sparkles className="mr-2 text-primary" size={20} />
            Importação Inteligente (IA)
          </h3>
          <p className="text-sm text-text-dim mb-4">
            Cole aqui os seus cartões de território mal formatados (do WhatsApp, bloco de notas, etc). 
            Nossa Inteligência Artificial vai ler, limpar as observações e organizar tudo automaticamente no seu banco de dados.
          </p>
          
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Cole o texto bruto aqui..."
            className="w-full h-40 bg-bg border border-border text-text-main rounded-md px-3 py-2 mb-4 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-y text-sm"
            disabled={importState.isProcessing}
          />
          
          <button
            onClick={handleBulkImport}
            disabled={importState.isProcessing || !bulkText.trim()}
            className="w-full sm:w-auto flex items-center justify-center bg-primary hover:bg-blue-400 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importState.isProcessing ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" /> Processando em 2º plano...
              </>
            ) : (
              <>
                <Sparkles size={18} className="mr-2" /> Organizar com IA
              </>
            )}
          </button>
        </div>

        <div className="bg-surface p-4 md:p-5 rounded-xl border border-border">
          <h3 className="text-lg font-medium text-text-main mb-2">Exportar Dados</h3>
          <p className="text-sm text-text-dim mb-4">
            Baixe um arquivo JSON com todos os seus bairros, territórios e endereços. Guarde este arquivo como backup.
          </p>
          <button
            onClick={handleExport}
            className="w-full sm:w-auto justify-center flex items-center px-4 py-2 bg-primary hover:bg-blue-400 text-white rounded-md font-medium transition-colors"
          >
            <Download size={18} className="mr-2" />
            Exportar Backup
          </button>
        </div>

        <div className="bg-surface p-4 md:p-5 rounded-xl border border-border">
          <h3 className="text-lg font-medium text-text-main mb-2">Importar Dados</h3>
          <p className="text-sm text-text-dim mb-4">
            Restaure seus dados a partir de um arquivo JSON de backup. 
            <span className="font-semibold text-warning ml-1 block sm:inline mt-1 sm:mt-0">Atenção: Isso substituirá todos os dados atuais!</span>
          </p>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            className="w-full sm:w-auto justify-center flex items-center px-4 py-2 bg-surface-accent border border-border hover:bg-border text-text-main rounded-md font-medium transition-colors"
          >
            <Upload size={18} className="mr-2" />
            Importar Backup
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 p-4 md:p-5 rounded-xl border border-red-500/20 mt-12">
          <h3 className="text-lg font-medium text-red-400 mb-2 flex items-center">
            <AlertCircle className="mr-2 text-red-400" size={20} />
            Zona de Perigo
          </h3>
          <p className="text-sm text-red-300/80 mb-4">
            Esta ação é irreversível. Todas as informações de bairros, territórios, endereços e histórico de chat serão permanentemente apagadas deste dispositivo.
          </p>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full sm:w-auto px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md font-medium transition-colors"
            >
              Apagar Tudo
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-red-400">
                Para confirmar, digite <span className="bg-red-500/20 px-1.5 py-0.5 rounded text-red-300">EXCLUIR</span> abaixo:
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  className="flex-1 bg-bg border border-red-500/30 text-text-main rounded-md px-3 py-2 focus:ring-1 focus:ring-red-500 outline-none uppercase"
                  autoFocus
                />
                <button
                  onClick={handleDeleteAll}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Confirmar Exclusão
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="bg-surface-accent border border-border hover:bg-border text-text-main px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Não, cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
