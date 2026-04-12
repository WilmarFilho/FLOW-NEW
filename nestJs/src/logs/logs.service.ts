import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateLogDto } from './dto/create-log.dto';

type LogParams = {
  action: string;
  context?: string;
  error?: unknown;
  message: string;
  metadata?: Record<string, any>;
  user_id?: string;
};

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createLog(dto: CreateLogDto) {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('app_logs')
        .insert({
          level: dto.level,
          action: dto.action,
          message: dto.message,
          metadata: dto.metadata,
          user_id: dto.user_id,
        });

      if (error) {
        this.logger.error(`Failed to insert log into Supabase: ${error.message}`);
        return null;
      }

      return data;
    } catch (e) {
      this.logger.error('Failed to create log', e);
      return null;
    }
  }

  async error(params: LogParams) {
    this.logger.error(this.formatConsoleMessage(params), this.extractStack(params.error));
    return this.createLog({
      level: 'error',
      action: params.action,
      message: params.message,
      metadata: this.buildMetadata(params),
      user_id: params.user_id,
    });
  }

  async warn(params: LogParams) {
    this.logger.warn(this.formatConsoleMessage(params));
    return this.createLog({
      level: 'warn',
      action: params.action,
      message: params.message,
      metadata: this.buildMetadata(params),
      user_id: params.user_id,
    });
  }

  async info(params: LogParams) {
    this.logger.log(this.formatConsoleMessage(params));
    return this.createLog({
      level: 'info',
      action: params.action,
      message: params.message,
      metadata: this.buildMetadata(params),
      user_id: params.user_id,
    });
  }

  private buildMetadata(params: LogParams) {
    const errorDetails = this.normalizeError(params.error);

    return {
      ...(params.context ? { context: params.context } : {}),
      ...(params.metadata || {}),
      ...(errorDetails || {}),
    };
  }

  private formatConsoleMessage(params: LogParams) {
    return params.context
      ? `[${params.context}] ${params.message}`
      : params.message;
  }

  private extractStack(error: unknown) {
    return error instanceof Error ? error.stack : undefined;
  }

  private normalizeError(error: unknown) {
    if (!error) {
      return null;
    }

    if (error instanceof Error) {
      return {
        error_message: error.message,
        error_name: error.name,
        stack: error.stack || null,
      };
    }

    return {
      error_raw: typeof error === 'string' ? error : JSON.stringify(error),
    };
  }
}
