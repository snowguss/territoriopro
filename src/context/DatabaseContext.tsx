import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Bairro, Database, Endereco, Territorio, ChatSession } from '../types';
import { processBulkImport } from '../services/ai';
import { useAuth } from './AuthContext';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase';

export interface ImportState {
  isProcessing: boolean;
  progress: number;
  status: 'idle' | 'processing' | 'success' | 'error';
}

interface DatabaseContextType {
  db: Database;
  setDb: React.Dispatch<React.SetStateAction<Database>>;
  addBairro: (name: string) => Bairro;
  updateBairro: (id: string, name: string) => void;
  removeBairro: (id: string) => void;
  addTerritorio: (bairroId: string, name: string) => Territorio;
  updateTerritorio: (id: string, name: string, lastAssignedDate?: string) => void;
  removeTerritorio: (id: string) => void;
  addEndereco: (territorioId: string, street: string, number: string, observations?: string, status?: string, statusComment?: string, statusDate?: string) => Endereco;
  updateEndereco: (id: string, street: string, number: string, observations?: string, status?: string, statusComment?: string, statusDate?: string) => void;
  removeEndereco: (id: string) => void;
  markTerritorioAssigned: (id: string) => void;
  saveChat: (session: ChatSession) => void;
  deleteChat: (id: string) => void;
  exportDb: () => string;
  importDb: (json: string) => boolean;
  mergeBulkData: (parsedData: any[]) => void;
  updateSettings: (city: string, state: string) => void;
  clearDatabase: () => void;
  moveTerritorio: (territorioId: string, overId: string, targetBairroId?: string) => void;
  importState: ImportState;
  startBulkImport: (text: string) => Promise<void>;
  getDb: () => Database;
}

const defaultDb: Database = { bairros: [], chats: [] };

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

const cleanExpiredStatuses = (data: Database): Database => {
  const nowMs = Date.now();
  const TWENTY_DAYS_MS = 20 * 24 * 60 * 60 * 1000;
  let changed = false;

  const newBairros = data.bairros.map(b => {
    const newTerritorios = b.territorios.map(t => {
      const newEnderecos = t.enderecos.map(e => {
        if (e.statusDate) {
          const dateMs = new Date(e.statusDate).getTime();
          if (nowMs - dateMs > TWENTY_DAYS_MS) {
            changed = true;
            const { status, statusComment, statusDate, ...rest } = e;
            return rest;
          }
        }
        return e;
      });
      return { ...t, enderecos: newEnderecos };
    });
    return { ...b, territorios: newTerritorios };
  });

  return changed ? { ...data, bairros: newBairros } : data;
};

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [db, setDbState] = useState<Database>(() => {
    // If not logged in but it has local data, maybe we load it initially, 
    // but the final load should happen from Firestore when auth is ready
    const saved = localStorage.getItem('territory_db');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved DB', e);
      }
    }
    return defaultDb;
  });

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const dbRef = useRef<Database>(db);

  const setDb = (updater: Database | ((prev: Database) => Database)) => {
    const nextState = typeof updater === 'function' ? updater(dbRef.current) : updater;
    dbRef.current = nextState;
    setDbState(nextState);
  };

  const [importState, setImportState] = useState<ImportState>({
    isProcessing: false,
    progress: 0,
    status: 'idle'
  });

  useEffect(() => {
    if (!user) return;
    
    // Initial fetch from Firestore
    const userRef = doc(firestoreDb, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.database) {
          try {
            const parsed = JSON.parse(data.database);
            const cleaned = cleanExpiredStatuses(parsed);
            setDb(cleaned);
          } catch(err) {
            console.error('Failed to parse remote DB', err);
          }
        }
      }
      setIsInitialLoad(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync back to Firestore on any change
  useEffect(() => {
    // We only write to firestore if it's not the initial load to prevent overwriting cloud with potentially empty initial state
    if (!user || isInitialLoad) return;

    // Use debounce to prevent too many writes when typing
    const timer = setTimeout(async () => {
      try {
        const userRef = doc(firestoreDb, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          database: JSON.stringify(dbRef.current)
        }, { merge: true });
        
        // Optionally update the local fallback
        localStorage.setItem('territory_db', JSON.stringify(dbRef.current));
      } catch (error) {
        console.error('Failed to sync to database', error);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [db, user, isInitialLoad]);

  const addBairro = (name: string) => {
    const newBairro: Bairro = { id: uuidv4(), name, territorios: [] };
    setDb(prev => ({ ...prev, bairros: [...prev.bairros, newBairro] }));
    return newBairro;
  };

  const updateBairro = (id: string, name: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => b.id === id ? { ...b, name } : b)
    }));
  };

  const removeBairro = (id: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.filter(b => b.id !== id)
    }));
  };

  const addTerritorio = (bairroId: string, name: string) => {
    const bairroExists = dbRef.current.bairros.some(b => b.id === bairroId);
    if (!bairroExists) {
      console.error(`Bairro com ID ${bairroId} não encontrado.`);
      return null;
    }
    const newTerritorio: Territorio = { id: uuidv4(), bairroId, name, enderecos: [] };
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => 
        b.id === bairroId 
          ? { ...b, territorios: [...b.territorios, newTerritorio] } 
          : b
      )
    }));
    return newTerritorio;
  };

  const updateTerritorio = (id: string, name: string, lastAssignedDate?: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => ({
        ...b,
        territorios: b.territorios.map(t => 
          t.id === id ? { ...t, name: name || t.name, lastAssignedDate: lastAssignedDate !== undefined ? lastAssignedDate : t.lastAssignedDate } : t
        )
      }))
    }));
  };

  const removeTerritorio = (id: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => ({
        ...b,
        territorios: b.territorios.filter(t => t.id !== id)
      }))
    }));
  };

  const addEndereco = (territorioId: string, street: string, number: string, observations?: string, status?: string, statusComment?: string, statusDate?: string) => {
    let territorioExists = false;
    for (const bairro of dbRef.current.bairros) {
      if (bairro.territorios.some(t => t.id === territorioId)) {
        territorioExists = true;
        break;
      }
    }
    if (!territorioExists) {
      console.error(`Território com ID ${territorioId} não encontrado.`);
      return null;
    }
    const newEndereco: Endereco = { id: uuidv4(), street, number, observations, status, statusComment, statusDate };
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => ({
        ...b,
        territorios: b.territorios.map(t => 
          t.id === territorioId 
            ? { ...t, enderecos: [...t.enderecos, newEndereco] } 
            : t
        )
      }))
    }));
    return newEndereco;
  };

  const updateEndereco = (id: string, street: string, number: string, observations?: string, status?: string, statusComment?: string, statusDate?: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => ({
        ...b,
        territorios: b.territorios.map(t => ({
          ...t,
          enderecos: t.enderecos.map(e => 
            e.id === id ? { ...e, street, number, observations, status, statusComment, statusDate } : e
          )
        }))
      }))
    }));
  };

  const removeEndereco = (id: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => ({
        ...b,
        territorios: b.territorios.map(t => ({
          ...t,
          enderecos: t.enderecos.filter(e => e.id !== id)
        }))
      }))
    }));
  };

  const markTerritorioAssigned = (id: string) => {
    setDb(prev => ({
      ...prev,
      bairros: prev.bairros.map(b => ({
        ...b,
        territorios: b.territorios.map(t => 
          t.id === id ? { ...t, lastAssignedDate: new Date().toISOString() } : t
        )
      }))
    }));
  };

  const saveChat = (session: ChatSession) => {
    setDb(prev => {
      const chats = prev.chats || [];
      const existingIndex = chats.findIndex(c => c.id === session.id);
      if (existingIndex >= 0) {
        const newChats = [...chats];
        newChats[existingIndex] = session;
        return { ...prev, chats: newChats };
      } else {
        return { ...prev, chats: [session, ...chats] };
      }
    });
  };

  const deleteChat = (id: string) => {
    setDb(prev => ({
      ...prev,
      chats: (prev.chats || []).filter(c => c.id !== id)
    }));
  };

  const exportDb = () => {
    return JSON.stringify(db, null, 2);
  };

  const importDb = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed && Array.isArray(parsed.bairros)) {
        setDb(parsed);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const mergeBulkData = (parsedData: any[]) => {
    setDb(prev => {
      const newDb = { ...prev };
      const bairros = [...newDb.bairros];

      parsedData.forEach(inBairro => {
        let bairro = bairros.find(b => b.name.toLowerCase() === inBairro.bairro.toLowerCase());
        if (!bairro) {
          bairro = { id: uuidv4(), name: inBairro.bairro, territorios: [] };
          bairros.push(bairro);
        }

        inBairro.territorios.forEach((inTerritorio: any) => {
          let territorio = bairro.territorios.find(t => t.name.toLowerCase() === inTerritorio.name.toLowerCase());
          if (!territorio) {
            territorio = { id: uuidv4(), bairroId: bairro.id, name: inTerritorio.name, enderecos: [] };
            bairro.territorios.push(territorio);
          }

          inTerritorio.enderecos.forEach((inEndereco: any) => {
            // Avoid exact duplicates
            const exists = territorio.enderecos.find(e => e.street.toLowerCase() === inEndereco.street.toLowerCase() && e.number === inEndereco.number);
            if (!exists) {
              territorio.enderecos.push({
                id: uuidv4(),
                street: inEndereco.street,
                number: inEndereco.number,
                observations: inEndereco.observations || ''
              });
            }
          });
        });
      });

      return { ...newDb, bairros };
    });
  };

  const updateSettings = (city: string, state: string) => {
    setDb(prev => ({ ...prev, city, state }));
  };

  const clearDatabase = () => {
    setDb(defaultDb);
    localStorage.removeItem('territory_db');
  };

  const moveTerritorio = (territorioId: string, overId: string, targetBairroId?: string) => {
    setDb(prev => {
      // 1. Solidify alphabetical order into manual order for any bairro involved that isn't already manual
      const workingBairros = prev.bairros.map(b => {
        if (!b.manualOrder) {
          return {
            ...b,
            territorios: [...b.territorios].sort((a, b) => 
              a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            ),
            manualOrder: true
          };
        }
        return b;
      });

      let sourceBairroId = '';
      let sourceIndex = -1;
      
      // Find source
      workingBairros.forEach(b => {
        const idx = b.territorios.findIndex(t => t.id === territorioId);
        if (idx !== -1) {
          sourceBairroId = b.id;
          sourceIndex = idx;
        }
      });

      if (!sourceBairroId) return prev;

      let destinationBairroId = '';
      let destinationIndex = -1;

      if (targetBairroId) {
        destinationBairroId = targetBairroId;
        destinationIndex = 0; // Drop on header, put at start
      } else {
        // Find if overId is a territorio
        workingBairros.forEach(b => {
          const idx = b.territorios.findIndex(t => t.id === overId);
          if (idx !== -1) {
            destinationBairroId = b.id;
            destinationIndex = idx;
          }
        });
      }

      if (!destinationBairroId) return prev;

      const newBairros = [...workingBairros];
      
      const sourceBairroIndex = newBairros.findIndex(b => b.id === sourceBairroId);
      const destBairroIndex = newBairros.findIndex(b => b.id === destinationBairroId);
      
      const sourceBairro = { ...newBairros[sourceBairroIndex], territorios: [...newBairros[sourceBairroIndex].territorios] };
      const [movedTerritorio] = sourceBairro.territorios.splice(sourceIndex, 1);
      movedTerritorio.bairroId = destinationBairroId;

      if (sourceBairroIndex === destBairroIndex) {
        sourceBairro.territorios.splice(destinationIndex, 0, movedTerritorio);
        newBairros[sourceBairroIndex] = sourceBairro;
      } else {
        const destBairro = { ...newBairros[destBairroIndex], territorios: [...newBairros[destBairroIndex].territorios] };
        destBairro.territorios.splice(destinationIndex, 0, movedTerritorio);
        newBairros[sourceBairroIndex] = sourceBairro;
        newBairros[destBairroIndex] = destBairro;
      }

      return { ...prev, bairros: newBairros };
    });
  };

  const startBulkImport = async (text: string) => {
    if (!text.trim()) return;
    setImportState({ isProcessing: true, progress: 0, status: 'processing' });

    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of lines) {
      currentChunk += line + '\n';
      if (currentChunk.length > 2000) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk);
    }

    let processed = 0;
    let hasErrors = false;

    for (const chunk of chunks) {
      try {
        const parsedData = await processBulkImport(chunk, db.city, db.state);
        if (parsedData && Array.isArray(parsedData)) {
          mergeBulkData(parsedData);
        }
      } catch (error) {
        console.error('Error processing chunk:', error);
        hasErrors = true;
      }
      processed++;
      setImportState(prev => ({ ...prev, progress: Math.round((processed / chunks.length) * 100) }));
    }

    setImportState({
      isProcessing: false,
      progress: 100,
      status: hasErrors && processed === 1 ? 'error' : 'success'
    });

    setTimeout(() => {
      setImportState(prev => prev.status === 'success' || prev.status === 'error' ? { ...prev, status: 'idle' } : prev);
    }, 5000);
  };

  const getDb = () => dbRef.current;

  return (
    <DatabaseContext.Provider value={{
      db, setDb, getDb,
      addBairro, updateBairro, removeBairro,
      addTerritorio, updateTerritorio, removeTerritorio,
      addEndereco, updateEndereco, removeEndereco,
      markTerritorioAssigned,
      saveChat, deleteChat,
      exportDb, importDb, mergeBulkData, updateSettings, clearDatabase, moveTerritorio,
      importState, startBulkImport
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
