import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let mockService: Partial<WhatsappService>;

  beforeEach(async () => {
    mockService = {
      listConnections: jest
        .fn()
        .mockResolvedValue([{ id: '1', nome: 'Test Connection' }]),
      createConnection: jest.fn().mockResolvedValue({
        connection: { id: '1' },
        qrCode: 'base64',
        pairingCode: null,
      }),
      updateConnection: jest
        .fn()
        .mockResolvedValue({ id: '1', nome: 'Updated' }),
      deleteConnection: jest.fn().mockResolvedValue({ deleted: true }),
      sendTestMessage: jest.fn().mockResolvedValue({ success: true }),
      handleWebhook: jest
        .fn()
        .mockResolvedValue({ processed: true, status: 'connected' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [{ provide: WhatsappService, useValue: mockService }],
    }).compile();

    controller = module.get<WhatsappController>(WhatsappController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list connections', async () => {
    const result = await controller.listConnections('user-1');
    expect(mockService.listConnections).toHaveBeenCalledWith('user-1');
    expect(result).toHaveLength(1);
  });

  it('should create a connection', async () => {
    const dto = { nome: 'Meu WhatsApp', user_id: 'user-1' };
    const result = await controller.createConnection('user-1', dto);
    expect(result.qrCode).toBe('base64');
  });

  it('should update a connection', async () => {
    const result = await controller.updateConnection('conn-1', 'user-1', {
      nome: 'Updated',
    });
    expect(result.nome).toBe('Updated');
  });

  it('should delete a connection', async () => {
    const result = await controller.deleteConnection('conn-1', 'user-1');
    expect(result.deleted).toBe(true);
  });

  it('should send test message', async () => {
    const result = await controller.sendTestMessage('conn-1', 'user-1', {
      number: '5511999999999',
      message: 'Hello',
    });
    expect(result.success).toBe(true);
  });

  it('should handle webhook', async () => {
    const result = await controller.handleWebhook({
      event: 'connection.update',
      instance: 'test_inst',
      data: { state: 'open' },
    });
    expect(result.processed).toBe(true);
  });
});
