import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookGuard } from './whatsapp-webhook.guard';

function createExecutionContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('WhatsappWebhookGuard', () => {
  it('accepts configured api key in webhook header', () => {
    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'api-key-1';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = guard.canActivate(
      createExecutionContext({
        headers: { apikey: 'api-key-1' },
        query: {},
      }),
    );

    expect(allowed).toBe(true);
  });

  it('accepts bearer token matching evolution api key', () => {
    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'api-key-1';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = guard.canActivate(
      createExecutionContext({
        headers: { authorization: 'Bearer api-key-1' },
        query: {},
      }),
    );

    expect(allowed).toBe(true);
  });
});
