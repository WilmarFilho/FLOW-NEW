import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { LogsService } from '../../logs/logs.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logsService: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const traceId = randomUUID();
    const startTime = Date.now();

    // Propaga o trace ID para responses e para uso interno nos serviços
    req['traceId'] = traceId;
    res.setHeader('X-Trace-Id', traceId);

    // URLs que não devem ser logadas para evitar ruído
    const skipPaths = ['/health', '/favicon.ico', '/metrics'];
    if (skipPaths.includes(req.path)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const status: number = res.statusCode;

        // Não logar GETs bem-sucedidos muito frequentes para reduzir volume
        const isSilentGet = req.method === 'GET' && status < 400 && duration < 200;
        if (isSilentGet) return;

        this.logsService.info({
          action: 'http.request',
          message: `${req.method} ${req.path} → ${status}`,
          trace_id: traceId,
          request_path: req.path,
          http_method: req.method,
          http_status: status,
          duration_ms: duration,
          ip_address: (req.headers['x-real-ip'] as string) ?? req.ip,
        });
      }),
      catchError((err: unknown) => {
        const duration = Date.now() - startTime;
        const status = (err as any)?.status ?? 500;

        this.logsService.error({
          action: 'http.error',
          message: (err as any)?.message ?? 'Unhandled error',
          error: err,
          trace_id: traceId,
          request_path: req.path,
          http_method: req.method,
          http_status: status,
          duration_ms: duration,
          ip_address: (req.headers['x-real-ip'] as string) ?? req.ip,
        });

        return throwError(() => err);
      }),
    );
  }
}
