export class CreateLogDto {
  level!: 'info' | 'warn' | 'error' | 'debug' | 'fatal';
  action!: string;
  message!: string;
  metadata?: Record<string, any>;
  user_id?: string;

  // Campos de observabilidade distribuída
  instance_id?: string;
  service_name?: string;
  trace_id?: string;
  request_path?: string;
  http_method?: string;
  http_status?: number;
  duration_ms?: number;
  ip_address?: string;
}
