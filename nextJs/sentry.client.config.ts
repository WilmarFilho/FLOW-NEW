import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',

  // Captura de replay de sessão quando ocorrer um erro — ajuda a ver o que o usuário estava fazendo
  integrations: [
    Sentry.replayIntegration({
      // Mascara textos e inputs por padrão para privacidade
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // 10% das sessões normais, 100% das sessões com erro
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // 20% das transações em produção para performance
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
});
