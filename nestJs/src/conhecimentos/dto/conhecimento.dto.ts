export class CreateConhecimentoDto {
  user_id: string;
  titulo: string;
  descricao?: string;
}

export class UpdateConhecimentoDto {
  titulo?: string;
  descricao?: string;
}

export class SendMessageDto {
  content: string;
}
