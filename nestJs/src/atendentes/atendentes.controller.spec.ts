import { Test, TestingModule } from '@nestjs/testing';
import { AtendentesController } from './atendentes.controller';

describe('AtendentesController', () => {
  let controller: AtendentesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtendentesController],
    }).compile();

    controller = module.get<AtendentesController>(AtendentesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
