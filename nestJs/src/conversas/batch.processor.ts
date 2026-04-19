import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConversasService } from './conversas.service';
import { Logger } from '@nestjs/common';

@Processor('conversation-batch', {
  // Configs customizáveis que ajudam nas réplicas: 
  // lockDuration de conversas que estão ativas e paradas
  concurrency: 10,
})
export class BatchProcessor extends WorkerHost {
  private readonly logger = new Logger(BatchProcessor.name);

  constructor(private readonly conversasService: ConversasService) {
    super();
  }

  async process(job: Job<{ conversaId: string }>): Promise<any> {
    const { conversaId } = job.data;
    this.logger.log(`[QUEUE] Iniciando processamento local id=${job.id} batch_conversaId=${conversaId}`);

    try {
      // Devolve para o fluxo nativo, garantido pelo Redis
      await this.conversasService.processConversaBatch(conversaId);
    } catch (error) {
      this.logger.error(`Erro ao processar batch para conversaId: ${conversaId}`, error);
      throw error;
    }
  }
}
