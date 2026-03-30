import { User } from './user';
import { Agent } from './agent';

export interface Connection {
  id: string;
  user_id: string;
  nome: string;
  numero: string;
  agente_id: string;
  status: boolean;
  ultima_atualizacao: string;
  user: User;
  agente: Agent;
}