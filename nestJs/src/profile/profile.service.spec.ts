import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let getClient: jest.Mock;

  beforeEach(async () => {
    getClient = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: SupabaseService,
          useValue: {
            getClient,
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('deve bloquear recuperação de senha para atendente', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { tipo_de_usuario: 'atendente' },
      error: null,
    });
    const ilike = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ ilike }));
    const from = jest.fn(() => ({ select }));
    getClient.mockReturnValue({ from });

    await expect(
      service.canRequestPasswordReset('atendente@teste.com'),
    ).resolves.toEqual({ allowed: false });
  });

  it('deve permitir recuperação de senha para admin', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { tipo_de_usuario: 'admin' },
      error: null,
    });
    const ilike = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ ilike }));
    const from = jest.fn(() => ({ select }));
    getClient.mockReturnValue({ from });

    await expect(
      service.canRequestPasswordReset('admin@teste.com'),
    ).resolves.toEqual({ allowed: true });
  });
});
