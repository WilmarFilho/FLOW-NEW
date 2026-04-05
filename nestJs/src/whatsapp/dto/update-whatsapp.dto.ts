export class UpdateWhatsappDto {
  nome?: string;
  agente_id?: string;
  conhecimento_id?: string;
  business_hours?: {
    timezone?: string;
    days?: Record<string, Array<{ start: string; end: string }>>;
  };
  appointment_slot_minutes?: number;
}
