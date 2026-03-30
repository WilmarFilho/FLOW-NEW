import { Message } from './message';

export interface Chat {
  connection_id: string;
  contato_nome: string;
  contato_numero: string;
  foto_perfil: string | null;
  ia_ativa: boolean;
  ia_desligada_em: string | null;
  id: string;
  status: 'Close' | 'Open';
  ultima_atualizacao: string;
  ultima_mensagem: Partial<Message>;
  user_id: string | null;
  user_nome: string | null;
}

export interface ChatFilters {
  search: string | null;
  connection_id: string | null;
  attendant_id: string | null;
  iaStatus: 'todos' | 'ativa' | 'desativada';
  status: 'Open' | 'Close';
  owner: 'all' | 'mine';
  isFetching: boolean;
}