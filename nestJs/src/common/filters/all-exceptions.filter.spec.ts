import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { LogsService } from '../../logs/logs.service';

function createHost(request: Record<string, unknown>, response: { status: jest.Mock; json: jest.Mock }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  it('writes warn logs for 4xx exceptions', async () => {
    const logsService = {
      error: jest.fn(),
      warn: jest.fn().mockResolvedValue(null),
    } as unknown as LogsService;
    const filter = new AllExceptionsFilter(logsService);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await filter.catch(
      new BadRequestException('Payload inválido'),
      createHost(
        { method: 'POST', url: '/contatos', body: { nome: 'x' }, query: {} },
        response,
      ),
    );

    expect((logsService as any).warn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HTTP POST /contatos',
        message: 'Payload inválido',
      }),
    );
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('writes error logs for unexpected exceptions', async () => {
    const logsService = {
      error: jest.fn().mockResolvedValue(null),
      warn: jest.fn(),
    } as unknown as LogsService;
    const filter = new AllExceptionsFilter(logsService);
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await filter.catch(
      new Error('Falha interna'),
      createHost(
        { method: 'GET', url: '/campanhas', body: {}, query: { page: '1' } },
        response,
      ),
    );

    expect((logsService as any).error).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HTTP GET /campanhas',
        message: 'Internal server error',
      }),
    );
    expect(response.status).toHaveBeenCalledWith(500);
  });
});
