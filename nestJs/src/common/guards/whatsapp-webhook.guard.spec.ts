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
  it('accepts configured api key in webhook header', async () => {
    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'api-key-1';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = await guard.canActivate(
      createExecutionContext({
        headers: { apikey: 'api-key-1' },
        query: {},
      }),
    );

    expect(allowed).toBe(true);
  });

  it('accepts bearer token matching evolution api key', async () => {
    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'api-key-1';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = await guard.canActivate(
      createExecutionContext({
        headers: { authorization: 'Bearer api-key-1' },
        query: {},
      }),
    );

    expect(allowed).toBe(true);
  });

  it('prefers header api key over body api key', async () => {
    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'SUA_KEY';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = await guard.canActivate(
      createExecutionContext({
        body: { apikey: '2F332F69-CBCA-4FDC-A211-8F4BB2433CB1' },
        headers: { apikey: 'SUA_KEY' },
        query: {},
      }),
    );

    expect(allowed).toBe(true);
  });

  it('accepts instance api key fetched from evolution', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => [
          {
            instance: {
              apikey: '4DE05338-F4B8-4182-8110-0D1CA81D8110',
            },
          },
        ],
      } as Response);

    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'SUA_KEY';
        }

        if (key === 'EVOLUTION_API_URL') {
          return 'http://localhost:8081';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = await guard.canActivate(
      createExecutionContext({
        body: { instance: 'flow_test' },
        headers: { apikey: '4DE05338-F4B8-4182-8110-0D1CA81D8110' },
        query: {},
      }),
    );

    expect(allowed).toBe(true);
    fetchMock.mockRestore();
  });

  it('accepts dynamic instance api key sent in webhook body', async () => {
    const guard = new WhatsappWebhookGuard({
      get: jest.fn((key: string) => {
        if (key === 'EVOLUTION_API_KEY') {
          return 'SUA_KEY';
        }

        if (key === 'EVOLUTION_API_URL') {
          return 'http://localhost:8081';
        }

        return null;
      }),
    } as unknown as ConfigService);

    const allowed = await guard.canActivate(
      createExecutionContext({
        body: {
          instance: 'flow_test',
          apikey: '998C1111-1111-1111-1111-11119E02',
        },
        headers: {},
        query: {},
      }),
    );

    expect(allowed).toBe(true);
  });
});
