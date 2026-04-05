export class CreateConversaDto {
  contato_id?: string;
  whatsapp_connection_id!: string;
  contact_name?: string;
  contact_whatsapp?: string;
}

export class SendConversaMessageDto {
  content!: string;
}

export class ToggleConversaAiDto {
  enabled!: boolean;
}
