export class CreateLogDto {
  level!: 'info' | 'warn' | 'error' | 'debug' | 'fatal';
  action!: string;
  message!: string;
  metadata?: Record<string, any>;
  user_id?: string;
}
