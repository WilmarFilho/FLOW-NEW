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

    if (status >= 500) {
      await this.logsService.error({
        action: `HTTP ${request.method} ${request.url}`,
        context: AllExceptionsFilter.name,
        error: exception,
        message,
        metadata: {
          statusCode: status,
          path: request.url,
          body: request.body,
          query: request.query,
          exceptionResponse,
        },
      });
    } else {
      await this.logsService.warn({
        action: `HTTP ${request.method} ${request.url}`,
        context: AllExceptionsFilter.name,
        error: exception,
        message,
        metadata: {
          statusCode: status,
          path: request.url,
          body: request.body,
          query: request.query,
          exceptionResponse,
        },
      });
    }

    const errorMessage =
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
        ? exceptionResponse['message']
        : message;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    });
  }
}
