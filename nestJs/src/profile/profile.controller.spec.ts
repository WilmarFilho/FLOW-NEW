import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { UserGuard } from '../common/guards/user.guard';
import { SupabaseService } from '../supabase/supabase.service';

describe('ProfileController', () => {
  let controller: ProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            updateProfile: jest.fn(),
            updateAvatar: jest.fn(),
          },
        },
        {
          provide: UserGuard,
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

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
