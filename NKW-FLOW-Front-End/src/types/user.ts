export type TipoUsuario = 'admin' | 'atendente';
export type ModoTela = 'Black' | 'White';
export type ModoSidebar = 'Full' | 'Minimal';

export interface User {
  cidade: string;
  endereco: string;
  numero: string;
  foto_perfil?: string;
  email: string;
  nome: string;
  password: string
  tipo_de_usuario: TipoUsuario;
  id: string;
  auth_id: string;
  user_admin_id?: string;
  role?: string;
  connection_id?: string;
  connection_nome?: string;
  status: boolean;
  modo_tela: ModoTela;
  modo_side_bar: ModoSidebar;
  mostra_nome_mensagens: boolean;
  modo_notificacao_atendente: boolean;
  notificacao_para_entrar_conversa: boolean;
  notificacao_necessidade_de_entrar_conversa: boolean;
  notificacao_novo_chat: boolean;
  criado_em: string;
  ref_code: string;
  referrals_count: number | null;
  discount_percent: number;
  ai_trigger_word: string | null;
  plano?: string | null;
  subscription_status?: string | null;
}