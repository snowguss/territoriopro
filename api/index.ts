import express from "express";
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Você é um assistente virtual especializado em gerenciar "Cartões de Território" para um trabalho de visitação.
Sua função é ajudar o usuário a manter o banco de dados de territórios atualizado, adicionar novos bairros, territórios e endereços, e remover ou editar os existentes.
Você também deve ajudar o usuário a não procrastinar, sendo proativo e amigável.

O banco de dados é estruturado assim:
- Bairros contêm Territórios.
- Territórios contêm Endereços.
- Cada Endereço tem rua, número e observações (opcional).

DIRETRIZES PARA CRIAÇÃO EM CASCATA:
Se o usuário pedir para criar um bairro, um território e um endereço ao mesmo tempo (ou apenas bairro e território), você DEVE fazer isso em etapas sequenciais, pois precisa dos IDs gerados:
1. Primeiro chame a ferramenta \`add_bairro\`.
2. O sistema retornará o ID do bairro criado.
3. Em seguida, chame a ferramenta \`add_territorio\` usando o ID do bairro retornado.
4. O sistema retornará o ID do território criado.
5. Por fim, chame a ferramenta \`add_endereco\` usando o ID do território retornado.
NÃO chame essas ferramentas em paralelo (ao mesmo tempo). Se você tentar criar um território com um ID de bairro inventado, a operação falhará. Aguarde a resposta de uma ferramenta para usar o ID na próxima.

O "ESTADO ATUAL DO BANCO DE DADOS" fornecido abaixo reflete o estado no início da conversa. Ele NÃO será atualizado imediatamente após você chamar uma ferramenta de criação.
Portanto, confie SEMPRE no ID retornado pela resposta da ferramenta (ex: "Bairro adicionado com ID 123") para fazer as chamadas subsequentes.

DIRETRIZES PARA ADIÇÃO DE NOVOS ENDEREÇOS:
Muitas vezes o usuário enviará apenas uma rua, número e observação (ex: "Rua das Cerejas, 123 - falar com Maria"), sem especificar o bairro ou território.
Nesses casos, você DEVE:
1. Procurar no "ESTADO ATUAL DO BANCO DE DADOS" se essa rua já existe em algum território.
2. Se a rua já existir em um território específico, assuma que o novo endereço pertence a esse mesmo território e adicione-o lá usando a ferramenta \`add_endereco\`.
3. Se a rua não existir no banco de dados, ou se existir em múltiplos territórios diferentes e você não tiver certeza, PERGUNTE ao usuário em qual bairro e território o endereço deve ser adicionado antes de usar a ferramenta.

Sempre que o usuário pedir para adicionar, remover ou editar algo, use as ferramentas (tools) disponíveis para fazer a alteração no banco de dados.
Se faltarem informações cruciais para a ferramenta, pergunte antes de chamar.

Se o usuário pedir sugestões de territórios para visitar, use a ferramenta \`suggest_territories\` ou analise o banco de dados fornecido para encontrar territórios que não são visitados há muito tempo (ex: mais de 20 dias).
Para gerar a mensagem do WhatsApp de um território, use a ferramenta \`generate_whatsapp_message\`.

Sempre responda em português do Brasil de forma clara e objetiva.
`;

const tools: FunctionDeclaration[] = [
  {
    name: 'add_bairro',
    description: 'Adiciona um novo bairro ao banco de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: { name: { type: Type.STRING, description: 'Nome do bairro' } },
      required: ['name']
    }
  },
  {
    name: 'remove_bairro',
    description: 'Remove um bairro do banco de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING, description: 'ID do bairro' } },
      required: ['id']
    }
  },
  {
    name: 'add_territorio',
    description: 'Adiciona um novo território a um bairro existente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        bairroId: { type: Type.STRING, description: 'ID do bairro' },
        name: { type: Type.STRING, description: 'Nome ou número do território (ex: "6" ou "Território 6")' }
      },
      required: ['bairroId', 'name']
    }
  },
  {
    name: 'remove_territorio',
    description: 'Remove um território do banco de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING, description: 'ID do território' } },
      required: ['id']
    }
  },
  {
    name: 'add_endereco',
    description: 'Adiciona um novo endereço a um território existente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        territorioId: { type: Type.STRING, description: 'ID do território' },
        street: { type: Type.STRING, description: 'Nome da rua' },
        number: { type: Type.STRING, description: 'Número do endereço' },
        observations: { type: Type.STRING, description: 'Observações sobre o endereço (opcional)' }
      },
      required: ['territorioId', 'street', 'number']
    }
  },
  {
    name: 'remove_endereco',
    description: 'Remove um endereço do banco de dados.',
    parameters: {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING, description: 'ID do endereço' } },
      required: ['id']
    }
  },
  {
    name: 'mark_territorio_assigned',
    description: 'Marca um território como designado/visitado hoje.',
    parameters: {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING, description: 'ID do território' } },
      required: ['id']
    }
  },
  {
    name: 'generate_whatsapp_message',
    description: 'Gera a mensagem formatada para o WhatsApp de um território específico.',
    parameters: {
      type: Type.OBJECT,
      properties: { territorioId: { type: Type.STRING, description: 'ID do território' } },
      required: ['territorioId']
    }
  },
  {
    name: 'suggest_territories',
    description: 'Sugere territórios que não são visitados há mais de 20 dias ou que nunca foram visitados.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: []
    }
  }
];

const app = express();
app.use(express.json({ limit: '10mb' })); // Higher limit for bulk imports and db state

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, db, city, state } = req.body;
    const currentDate = new Date().toISOString();
    let locationContext = '';
    if (city || state) {
      locationContext = `\n\nLOCALIZAÇÃO BASE DO USUÁRIO: ${city || ''} - ${state || ''}. Use isso como contexto geográfico se necessário.`;
    }
    
    const dbForAI = {
      bairros: db.bairros,
      city: db.city,
      state: db.state
    };
    
    const systemInstructionWithState = SYSTEM_INSTRUCTION + locationContext + '\n\nDATA ATUAL: ' + currentDate + '\n\nESTADO ATUAL DO BANCO DE DADOS:\n' + JSON.stringify(dbForAI);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: messages,
      config: {
        systemInstruction: systemInstructionWithState,
        tools: [{ functionDeclarations: tools }],
        temperature: 0.2,
      }
    });
    res.json(response);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/import", async (req, res) => {
  try {
    const { rawText, city, state } = req.body;
    const locationContext = (city || state) ? `\n\nLOCALIZAÇÃO BASE: ${city || ''} - ${state || ''}. Use isso como contexto geográfico se necessário.` : '';
    const prompt = `
      Você é um assistente de extração e limpeza de dados. O usuário fornecerá um texto bruto e mal formatado contendo informações de territórios, bairros e endereços.
      Sua tarefa é extrair esses dados, corrigir a formatação (especialmente das observações, deixando-as claras e concisas) e retornar um JSON estrito.${locationContext}

      O formato do JSON DEVE ser uma lista de bairros, onde cada bairro tem uma lista de territórios, e cada território tem uma lista de endereços.
      Exemplo de estrutura esperada:
      [
        {
          "bairro": "Nome do Bairro",
          "territorios": [
            {
              "name": "Número ou Nome do Território",
              "enderecos": [
                {
                  "street": "Nome da Rua",
                  "number": "Número da casa/prédio",
                  "observations": "Observações limpas e formatadas"
                }
              ]
            }
          ]
        }
      ]

      Texto bruto fornecido pelo usuário:
      ${rawText}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (response.text) {
      return res.json(JSON.parse(response.text));
    }
    res.status(500).json({ error: "No response text" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
