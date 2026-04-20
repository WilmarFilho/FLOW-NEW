// CRÍTICO: instrument.ts deve ser importado ANTES de qualquer outro módulo
// para que o Sentry possa interceptar imports e instrumentar corretamente.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const corsOrigins = (
    process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Interceptor global de logging HTTP com trace ID e métricas de latência
  app.useGlobalInterceptors(app.get(HttpLoggingInterceptor));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`API listening on port ${port}`);
  logger.log(`Instance: ${process.env.HOSTNAME || 'local'} | Service: ${process.env.SERVICE_NAME || 'backend'}`);
}
void bootstrap();
