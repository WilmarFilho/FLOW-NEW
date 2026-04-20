import * as os from 'os';
import * as Sentry from '@sentry/nestjs';
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
  // Campos de observabilidade
  trace_id?: string;
  request_path?: string;
  http_method?: string;
  http_status?: number;
  duration_ms?: number;
  ip_address?: string;
};

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  /** Identificador da instância (hostname do container Docker) */
  private readonly instanceId = process.env.HOSTNAME ?? os.hostname();
  /** Nome do serviço no Swarm (definido via env SERVICE_NAME) */
  private readonly serviceName = process.env.SERVICE_NAME ?? 'backend';

  constructor(private readonly supabaseService: SupabaseService) {}

  async createLog(dto: CreateLogDto) {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('app_logs')
        .insert({
          level: dto.level,
          action: dto.action,
          message: dto.message,
          metadata: dto.metadata,
          user_id: dto.user_id,
          // Observabilidade distribuída
          instance_id: dto.instance_id ?? this.instanceId,
          service_name: dto.service_name ?? this.serviceName,
          trace_id: dto.trace_id,
          request_path: dto.request_path,
          http_method: dto.http_method,
          http_status: dto.http_status,
          duration_ms: dto.duration_ms,
          ip_address: dto.ip_address,
        });

      if (error) {
        this.logger.error(`Failed to insert log into Supabase: ${error.message}`);
        return null;
      }

      return true;
    } catch (e) {
      this.logger.error('Failed to create log', e);
      return null;
    }
  }

  async error(params: LogParams) {
    this.logger.error(this.formatConsoleMessage(params), this.extractStack(params.error));

    // Reportar ao Sentry todo erro com status >= 500 ou sem status (exceção não-HTTP)
    const isServerError = !params.http_status || params.http_status >= 500;
    if (isServerError && params.error) {
      Sentry.withScope((scope) => {
        scope.setTag('action', params.action);
        scope.setTag('service', this.serviceName);
        scope.setTag('instance', this.instanceId);
        if (params.trace_id) scope.setTag('trace_id', params.trace_id);
        if (params.request_path) scope.setTag('path', params.request_path);
        if (params.user_id) scope.setUser({ id: params.user_id });
        if (params.metadata) scope.setExtras(params.metadata);
        Sentry.captureException(params.error);
      });
    }

    return this.createLog({
      level: 'error',
      action: params.action,
      message: params.message,
      metadata: this.buildMetadata(params),
      user_id: params.user_id,
      trace_id: params.trace_id,
      request_path: params.request_path,
      http_method: params.http_method,
      http_status: params.http_status,
      duration_ms: params.duration_ms,
      ip_address: params.ip_address,
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
      trace_id: params.trace_id,
      request_path: params.request_path,
      http_method: params.http_method,
      http_status: params.http_status,
      duration_ms: params.duration_ms,
      ip_address: params.ip_address,
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
      trace_id: params.trace_id,
      request_path: params.request_path,
      http_method: params.http_method,
      http_status: params.http_status,
      duration_ms: params.duration_ms,
      ip_address: params.ip_address,
    });
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private buildMetadata(params: LogParams) {
    const errorDetails = this.normalizeError(params.error);
    return {
      ...(params.context ? { context: params.context } : {}),
      ...(params.metadata || {}),
      ...(errorDetails || {}),
    };
  }

  private formatConsoleMessage(params: LogParams) {
    return params.context ? `[${params.context}] ${params.message}` : params.message;
  }

  private extractStack(error: unknown) {
    return error instanceof Error ? error.stack : undefined;
  }

  private normalizeError(error: unknown) {
    if (!error) return null;
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
