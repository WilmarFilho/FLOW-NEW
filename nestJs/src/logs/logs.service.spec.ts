import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LogsService', () => {
  let service: LogsService;
  let mockClient: {
    from: jest.Mock;
    insert: jest.Mock;
  };

  beforeEach(async () => {
    mockClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: [{ id: 'log-1' }], error: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('persists log entries to app_logs', async () => {
    await service.createLog({
      action: 'tests.createLog',
      level: 'error',
      message: 'failure',
      metadata: { foo: 'bar' },
      user_id: 'user-1',
    });

    expect(mockClient.from).toHaveBeenCalledWith('app_logs');
    expect(mockClient.insert).toHaveBeenCalledWith({
      action: 'tests.createLog',
      level: 'error',
      message: 'failure',
      metadata: { foo: 'bar' },
      user_id: 'user-1',
    });
  });

  it('normalizes error details when using error()', async () => {
    const error = new Error('boom');

    await service.error({
      action: 'tests.error',
      context: 'LogsServiceSpec',
      error,
      message: 'Request failed',
      metadata: { path: '/x' },
      user_id: 'user-2',
    });

    expect(mockClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tests.error',
        level: 'error',
        message: 'Request failed',
        user_id: 'user-2',
        metadata: expect.objectContaining({
          context: 'LogsServiceSpec',
          path: '/x',
          error_message: 'boom',
          error_name: 'Error',
        }),
      }),
    );
  });

  it('persists warnings through warn()', async () => {
    await service.warn({
      action: 'tests.warn',
      context: 'LogsServiceSpec',
      message: 'Potential issue',
    });

    expect(mockClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tests.warn',
        level: 'warn',
        message: 'Potential issue',
        metadata: expect.objectContaining({
          context: 'LogsServiceSpec',
        }),
      }),
    );
  });
});
