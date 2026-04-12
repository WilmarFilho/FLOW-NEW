import { Test, TestingModule } from '@nestjs/testing';
import { AtendentesService } from './atendentes.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AtendentesService', () => {
  let service: AtendentesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtendentesService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AtendentesService>(AtendentesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
