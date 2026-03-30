export interface Message {
  id: string;
  chat_id: string;
  remetente: string;
  mensagem: string;
  mimetype: string;
  base64: string;
  transcricao: string;
  criado_em: string;
  file_name: string;
  quote_id: string;
  user_id: string;
  quote_message: Message;
  excluded: boolean;
  filename: string;
}

export interface SendMessagePayload {
  chat_id?: string;
  user_id?: string;
  mensagem: string;
  mimetype?: string;
  base64?: string;
  number?: string;
  quote_id?: string;
  connection_id?: string;
}