import { Test, TestingModule } from '@nestjs/testing';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('LogsController', () => {
  let controller: LogsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [
        LogsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnThis(),
              insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<LogsController>(LogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
