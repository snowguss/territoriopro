export interface Endereco {
  id: string;
  street: string;
  number: string;
  observations?: string;
  status?: string; // Optional field for backward compatibility
  statusComment?: string; // Temporary comment from the publisher
  statusDate?: string; // ISO Date string of when the status/comment was updated
}

export interface Territorio {
  id: string;
  bairroId: string;
  name: string; // e.g., "6" or "Território 6"
  type?: 'REGULAR' | 'CENSUS'; // REGULAR for addresses, CENSUS for mapping blocks
  instructions?: string; // Text for census limits or general instructions
  lastAssignedDate?: string; // ISO string
  enderecos: Endereco[];
}

export interface Bairro {
  id: string;
  name: string;
  territorios: Territorio[];
  manualOrder?: boolean;
}

export interface Database {
  bairros: Bairro[];
  chats?: ChatSession[];
  city?: string;
  state?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  parts: any[];
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
}
