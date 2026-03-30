import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogsService } from '../../logs/logs.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logsService: LogsService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Log the error to Supabase via the background
    this.logsService.createLog({
      level: status >= 500 ? 'error' : 'warn',
      action: `HTTP ${request.method} ${request.url}`,
      message: message,
      metadata: {
        statusCode: status,
        path: request.url,
        body: request.body,
        query: request.query,
        exceptionResponse,
        stack: exception instanceof Error ? exception.stack : null,
      },
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
