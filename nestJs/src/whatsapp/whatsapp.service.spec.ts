import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from './whatsapp.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EvolutionApiService } from './evolution-api.service';
import { LogsService } from '../logs/logs.service';
import { ConversasService } from '../conversas/conversas.service';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'uuid-1', instance_name: 'inst_1', status: 'connected' }, error: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: EvolutionApiService,
          useValue: {
            createInstance: jest.fn().mockResolvedValue({ qrcode: { base64: 'mock-qr' } }),
            connectInstance: jest.fn().mockResolvedValue({ base64: 'mock-qr-base64' }),
            deleteInstance: jest.fn().mockResolvedValue({}),
            logoutInstance: jest.fn().mockResolvedValue({}),
            sendTextMessage: jest.fn().mockResolvedValue({ key: { id: 'msg-1' } }),
            getInstanceStatus: jest.fn().mockResolvedValue({ state: 'open' }),
          },
        },
        {
          provide: LogsService,
          useValue: {
            createLog: jest.fn(),
          },
        },
        {
          provide: ConversasService,
          useValue: {
            handleWhatsappWebhook: jest.fn().mockResolvedValue({ processed: true }),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list connections for a user', async () => {
    mockSupabaseClient.order.mockResolvedValue({
      data: [{ id: '1', nome: 'Test' }],
      error: null,
    });

    const result = await service.listConnections('user-1');
    expect(result).toBeDefined();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('whatsapp_connections');
  });

  it('should handle webhook connection.update event', async () => {
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const result = await service.handleWebhook({
      event: 'connection.update',
      instance: 'test_instance',
      data: { state: 'open' },
    });

    expect(result.processed).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('connected');
    } else {
      fail('Webhook de conexão deveria retornar um status de conexão.');
    }
  });

  it('should handle webhook CONNECTION_UPDATE event', async () => {
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const result = await service.handleWebhook({
      event: 'CONNECTION_UPDATE',
      instance: 'test_instance',
      data: { state: 'OPEN' },
    });

    expect(result.processed).toBe(true);
    if ('status' in result) {
      expect(result.status).toBe('connected');
    } else {
      fail('Webhook em caixa alta deveria retornar um status de conexão.');
    }
  });

  it('should delegate MESSAGES_UPSERT events to ConversasService', async () => {
    const result = await service.handleWebhook({
      event: 'MESSAGES_UPSERT',
      instance: 'test_instance',
      data: {},
    });

    expect(result).toEqual({ processed: true });
  });

  it('should return processed false for unknown event', async () => {
    const result = await service.handleWebhook({
      event: 'unknown.event',
      instance: 'test_instance',
    });

    expect(result.processed).toBe(false);
  });
});
