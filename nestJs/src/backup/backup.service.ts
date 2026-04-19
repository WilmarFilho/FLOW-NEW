import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) { }

  // Executa toda semana: no domingo às 23:00 (assim atende sua necessidade de começar hoje e rodar toda semana)
  @Cron('0 14 * * 0')
  async handleWeeklyBackup() {
    this.logger.log('Iniciando backup semanal via pg_dump...');

    // Assegurar que DATABASE_URL existe nas env vars
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) {
      this.logger.error('Falha no backup: DATABASE_URL não definida.');
      return;
    }

    // Cria arquivo temporário
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const tempDir = path.join(process.cwd(), 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const filepath = path.join(tempDir, filename);

    try {
      // 1. Executa o pg_dump apontando para a string de conexão
      // O utilitário pg_dump precisa estar acessível no servidor onde a aplicação roda.
      const command = `pg_dump "${dbUrl}" -F p -f "${filepath}"`;
      await execAsync(command);

      this.logger.log('Dump gerado com sucesso no disco local.');

      // 2. Faz o upload para o bucket seguro no Supabase Storage
      const fileBuffer = fs.readFileSync(filepath);

      const { data, error } = await this.supabaseService.getClient()
        .storage
        .from('database-backups')
        .upload(filename, fileBuffer, {
          contentType: 'application/sql',
          upsert: true,
        });

      if (error) {
        throw new Error(`Erro ao subir backup para o Storage: ${error.message}`);
      }

      this.logger.log(`Backup finalizado com sucesso! Arquivo: ${filename}`);

    } catch (error) {
      this.logger.error(`Falha ao gerar ou subir backup: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 3. Limpeza do arquivo temporário
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        this.logger.log('Arquivo de backup temporário limpo do disco.');
      }
    }
  }
}
