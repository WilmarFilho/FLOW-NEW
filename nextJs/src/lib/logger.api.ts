// lib/logger.api.ts
export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'fatal';

interface LogPayload {
  level: LogLevel;
  action: string;
  message: string;
  metadata?: Record<string, any>;
  user_id?: string;
}

export const logger = {
  log: async (payload: LogPayload) => {
    try {
      // Usaremos o endpoint do NestJS (Assumindo que roda na porta 3001, ajuste conforme necessário)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to dispatch log to centralized logging backend', err);
    }
  },
  error: (action: string, error: unknown, metadata?: Record<string, any>) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.log({
      level: 'error',
      action,
      message,
      metadata: { ...metadata, stack },
    });
  },
  info: (action: string, message: string, metadata?: Record<string, any>) => {
    logger.log({ level: 'info', action, message, metadata });
  },
};
