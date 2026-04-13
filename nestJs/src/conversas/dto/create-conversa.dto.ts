export class CreateConversaDto {
  contato_id?: string;
  whatsapp_connection_id!: string;
  contact_name?: string;
  contact_whatsapp?: string;
}

export class SendConversaMessageDto {
  content!: string;
  reply_to_message_id?: string;
}

export class ToggleConversaAiDto {
  enabled!: boolean;
}

export class UpdateConversaAssignmentDto {
  assigned_user_id!: string | null;
}
