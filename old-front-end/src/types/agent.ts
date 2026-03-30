export interface Agent {
  id: string;
  tipo_de_agente: string;
  prompt_do_agente: string;
  descricao: string;
  criado_em: string;
}

export interface Rag {
  status_conhecimento: string;
  resumo: string;
}