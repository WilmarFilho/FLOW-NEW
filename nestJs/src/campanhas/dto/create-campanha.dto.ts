export class CreateCampanhaDto {
  nome!: string;
  contexto!: string;
  source_type!: 'lista' | 'connection';
  whatsapp_connection_id!: string;
  lista_id?: string;
  source_whatsapp_connection_id?: string;
}
