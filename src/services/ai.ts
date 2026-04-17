import { Database } from '../types';

export async function sendMessageToAI(
  messages: { role: 'user' | 'model'; parts: { text?: string; functionCall?: any; functionResponse?: any }[] }[],
  db: Database,
  handleFunctionCall: (call: any) => any
) {
  const payload = {
    messages,
    db: {
      bairros: db.bairros,
      city: db.city,
      state: db.state
    },
    city: db.city,
    state: db.state
  };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Falha na comunicação com o servidor de IA');
  }

  return response.json();
}

export const processBulkImport = async (rawText: string, city?: string, state?: string) => {
  const response = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, city, state })
  });

  if (!response.ok) {
    throw new Error('Falha no processamento pela IA no servidor');
  }

  return response.json();
};
