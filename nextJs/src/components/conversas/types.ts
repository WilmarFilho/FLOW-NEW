export type ConversationFilter = 'all' | 'mine' | 'unread' | 'ai' | 'deleted';
export type MobilePane = 'list' | 'chat';

export interface ConversationAssignedOption {
  auth_id: string;
  nome_completo: string | null;
}

export type ConversationMessageType =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'sticker'
  | 'unsupported';

export interface ConversationContact {
  id: string;
  nome: string;
  whatsapp: string;
  avatar_url: string | null;
}

export interface ConversationConnection {
  id: string;
  nome: string;
  cor: string | null;
  deleted_at?: string | null;
  numero: string | null;
  status: 'connected' | 'connecting' | 'disconnected';
}

export interface ConversationAssignedUser {
  auth_id: string;
  nome_completo: string | null;
  foto_perfil: string | null;
}

export interface ConversationSummary {
  id: string;
  profile_id: string;
  contato_id: string;
  whatsapp_connection_id: string;
  assigned_user_id: string | null;
  assigned_at: string | null;
  ai_enabled: boolean;
  ai_disabled_at: string | null;
  status: 'open' | 'archived';
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  contatos: ConversationContact | ConversationContact[] | null;
  whatsapp_connections: ConversationConnection | ConversationConnection[] | null;
  profile: ConversationAssignedUser | ConversationAssignedUser[] | null;
}

export interface ConversationMessage {
  id: string;
  conversa_id: string;
  profile_id: string;
  whatsapp_connection_id: string;
  direction: 'inbound' | 'outbound' | 'system';
  sender_type: 'customer' | 'user' | 'assistant' | 'system';
  sender_user_id: string | null;
  message_type: ConversationMessageType;
  content: string | null;
  media_url: string | null;
  media_path: string | null;
  media_mime_type: string | null;
  status: 'received' | 'sent' | 'failed';
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationOptions {
  connections: ConversationConnection[];
  contacts: ConversationContact[];
  assignedUsers: ConversationAssignedOption[];
}

export interface GroupedConversationMessage {
  id: string;
  messages: ConversationMessage[];
  senderType: ConversationMessage['sender_type'];
  direction: ConversationMessage['direction'];
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextOffset: number | null;
}
