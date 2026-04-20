import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// DEVE ser importado ANTES de qualquer outro módulo da aplicação
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.IMAGE_TAG || '0.0.0',

  integrations: [nodeProfilingIntegration()],

  // Capturar 100% das transações em dev, 20% em prod
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Não enviar PII por padrão
  sendDefaultPii: false,
});
