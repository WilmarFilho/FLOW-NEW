import { Test, TestingModule } from '@nestjs/testing';
import { AtendentesController } from './atendentes.controller';
import { AtendentesService } from './atendentes.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { SupabaseService } from '../supabase/supabase.service';

describe('AtendentesController', () => {
  let controller: AtendentesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtendentesController],
      providers: [
        {
          provide: AtendentesService,
          useValue: {
            listAtendentes: jest.fn(),
            createAtendente: jest.fn(),
            updateAtendente: jest.fn(),
            deleteAtendente: jest.fn(),
          },
        },
        {
          provide: AdminGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
        {
          provide: SupabaseService,
          useValue: {
            verifyAccessToken: jest.fn(),
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AtendentesController>(AtendentesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
