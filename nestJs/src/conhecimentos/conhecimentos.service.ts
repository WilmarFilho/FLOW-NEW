import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { LogsService } from '../logs/logs.service';
import {
  CreateConhecimentoDto,
  UpdateConhecimentoDto,
} from './dto/conhecimento.dto';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

@Injectable()
export class ConhecimentosService {
  private readonly logger = new Logger(ConhecimentosService.name);
  private readonly openai: OpenAI;
  private readonly EMBEDDING_MODEL = 'text-embedding-3-large';
  private readonly CHAT_MODEL = 'gpt-4.1';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY não configurada. Funcionalidades de IA estarão indisponíveis.',
      );
    }
    this.openai = new OpenAI({
      apiKey: apiKey || 'sk-placeholder-configure-env',
    });
  }

  // ─── CRUD ────────────────────────────────────────────

  async list(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list conhecimentos: ${error.message}`);
      throw error;
    }
    return data;
  }

  async getById(id: string, userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Base de conhecimento não encontrada');
    }
    return data;
  }

  async create(dto: CreateConhecimentoDto) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .insert({
        user_id: dto.user_id,
        titulo: dto.titulo,
        descricao: dto.descricao || null,
        status: 'building',
        total_chunks: 0,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create conhecimento: ${error.message}`);
      throw error;
    }

    return data;
  }

  async update(id: string, userId: string, dto: UpdateConhecimentoDto) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.titulo !== undefined) updateData.titulo = dto.titulo;
    if (dto.descricao !== undefined) updateData.descricao = dto.descricao;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update conhecimento: ${error.message}`);
      throw error;
    }
    if (!data) throw new NotFoundException('Base não encontrada');
    return data;
  }

  async delete(id: string, userId: string) {
    // Delete storage files
    const { data: files } = await this.supabaseService
      .getClient()
      .storage.from('conhecimento-files')
      .list(`${userId}/${id}`);

    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${id}/${f.name}`);
      await this.supabaseService
        .getClient()
        .storage.from('conhecimento-files')
        .remove(paths);
    }

    // Delete record (cascades to chunks & messages)
    const { error } = await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to delete conhecimento: ${error.message}`);
      throw error;
    }
    return { deleted: true };
  }

  // ─── MESSAGES / CHAT ────────────────────────────────

  async getMessages(conhecimentoId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conhecimento_messages')
      .select('*')
      .eq('conhecimento_id', conhecimentoId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to get messages: ${error.message}`);
      throw error;
    }
    return data || [];
  }

  async sendMessage(conhecimentoId: string, userId: string, content: string) {
    // 1. Verify ownership
    const base = await this.getById(conhecimentoId, userId);

    // 2. Save user message
    await this.saveMessage(conhecimentoId, 'user', content);

    // 3. Embed and store user message as a RAG chunk
    await this.embedAndStore(
      conhecimentoId,
      `Resposta do cliente: ${content}`,
      { type: 'chat_message' },
    );

    // 4. Get all existing chunks to evaluate knowledge completeness
    const knowledgeSummary = await this.evaluateKnowledge(conhecimentoId);

    // 5. Generate next AI question based on gaps
    const aiResponse = await this.generateNextQuestion(
      conhecimentoId,
      knowledgeSummary,
      content,
    );

    // 6. Save AI message with progress metadata
    await this.saveMessage(conhecimentoId, 'assistant', aiResponse.message, { progress: knowledgeSummary.percentual_conclusao });

    // 7. Update knowledge status & summary
    await this.supabaseService
      .getClient()
      .from('conhecimentos')
      .update({
        status: aiResponse.isComplete ? 'ready' : 'building',
        resumo: knowledgeSummary.o_que_ja_sabemos,
        percentual_conclusao: knowledgeSummary.percentual_conclusao,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conhecimentoId);

    // 6. Save user message
    await this.saveMessage(conhecimentoId, 'user', content);

    // 7. Save AI message with progress metadata (keeping metadata for extra tracking)
    await this.saveMessage(conhecimentoId, 'assistant', aiResponse.message, { progress: knowledgeSummary.percentual_conclusao });

    return {
      message: aiResponse.message,
      isComplete: aiResponse.isComplete,
      resumo: knowledgeSummary.o_que_ja_sabemos,
      percentual_conclusao: knowledgeSummary.percentual_conclusao,
    };
  }

  async startConversation(conhecimentoId: string, userId: string) {
    // Verify ownership
    await this.getById(conhecimentoId, userId);

    // Check if there are existing messages
    const existingMessages = await this.getMessages(conhecimentoId);
    if (existingMessages.length > 0) {
      return { messages: existingMessages, isExisting: true };
    }

    // Get knowledge summary to identify gaps
    const knowledgeSummary = await this.evaluateKnowledge(conhecimentoId);

    // Generate next AI question based on gaps
    const aiResponse = await this.generateNextQuestion(
      conhecimentoId,
      knowledgeSummary,
      '',
    );

    // Save AI message with progress metadata
    await this.saveMessage(conhecimentoId, 'assistant', aiResponse.message, { progress: knowledgeSummary.percentual_conclusao });

    const messages = await this.getMessages(conhecimentoId);
    return { messages, isExisting: false };
  }

  // ─── FILE UPLOAD & PROCESSING ──────────────────────

  async processFileUpload(
    conhecimentoId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    // Verify ownership
    await this.getById(conhecimentoId, userId);

    const mimeType = file.mimetype;
    const fileName = file.originalname;
    let extractedText = '';

    try {
      // 1. Upload file to Supabase Storage
      const storagePath = `${userId}/${conhecimentoId}/${Date.now()}_${fileName}`;
      const { error: uploadError } = await this.supabaseService
        .getClient()
        .storage.from('conhecimento-files')
        .upload(storagePath, file.buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        this.logger.error(`File upload failed: ${uploadError.message}`);
        throw new BadRequestException('Falha no upload do arquivo');
      }

      // 2. Extract text based on file type
      if (mimeType === 'application/pdf') {
        const pdfData = await pdfParse(file.buffer);
        extractedText = pdfData.text;
      } else if (
        mimeType === 'application/vnd.ms-excel' ||
        mimeType ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ) {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        const allData = sheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          return XLSX.utils.sheet_to_json(sheet, { header: 1 });
        });
        extractedText = JSON.stringify(allData, null, 2);
      } else if (mimeType.startsWith('image/')) {
        // Use GPT Vision to describe image
        const base64 = file.buffer.toString('base64');
        const visionResponse = await this.openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Descreva detalhadamente o conteúdo desta imagem. Se houver texto, transcreva-o. Se for um cardápio, tabela de preços ou documento, extraia todas as informações.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
        });
        extractedText =
          visionResponse.choices[0]?.message?.content || 'Sem conteúdo extraído';
      } else if (mimeType === 'text/plain') {
        extractedText = file.buffer.toString('utf-8');
      } else {
        throw new BadRequestException(
          'Tipo de arquivo não suportado. Use PDF, XLS, XLSX, imagem ou TXT.',
        );
      }

      // 3. Split text into chunks and embed
      const chunks = this.splitTextIntoChunks(extractedText, 1500);
      for (const chunk of chunks) {
        await this.embedAndStore(conhecimentoId, chunk, {
          type: 'file',
          fileName,
          mimeType,
          storagePath,
        });
      }

      // 4. Save a chat message acknowledging the file
      const ackMessage = `Recebi e processei o arquivo "${fileName}". ${chunks.length} trecho(s) de conhecimento foram extraídos e salvos na base.`;
      await this.saveMessage(conhecimentoId, 'assistant', ackMessage, {
        file_url: storagePath,
        file_type: mimeType,
        chunks_created: chunks.length,
      });

      // Save user upload as message too
      await this.saveMessage(
        conhecimentoId,
        'user',
        `[Arquivo enviado: ${fileName}]`,
        { file_url: storagePath, file_type: mimeType },
      );

      return {
        success: true,
        fileName,
        chunksCreated: chunks.length,
        message: ackMessage,
      };
    } catch (error) {
      this.logsService.createLog({
        level: 'error',
        action: 'conhecimentos.processFileUpload',
        message: error instanceof Error ? error.message : String(error),
        metadata: { conhecimentoId, fileName, mimeType },
        user_id: userId,
      });
      throw error;
    }
  }

  // ─── PRIVATE HELPERS ────────────────────────────────

  private async saveMessage(
    conhecimentoId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: Record<string, any> = {},
  ) {
    const { error } = await this.supabaseService
      .getClient()
      .from('conhecimento_messages')
      .insert({
        conhecimento_id: conhecimentoId,
        role,
        content,
        metadata,
      });

    if (error) {
      this.logger.error(`Failed to save message: ${error.message}`);
    }
  }

  private async embedAndStore(
    conhecimentoId: string,
    text: string,
    metadata: Record<string, any>,
  ) {
    try {
      // Generate embedding
      const embeddingResponse = await this.openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text,
      });
      const embedding = embeddingResponse.data[0].embedding;

      // Store chunk with embedding
      const { error } = await this.supabaseService
        .getClient()
        .from('conhecimento_chunks')
        .insert({
          conhecimento_id: conhecimentoId,
          content: text,
          metadata,
          embedding: JSON.stringify(embedding),
        });

      if (error) {
        this.logger.error(`Failed to store chunk: ${error.message}`);
        throw error;
      }

      // Update chunk count
      const { count } = await this.supabaseService
        .getClient()
        .from('conhecimento_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('conhecimento_id', conhecimentoId);

      await this.supabaseService
        .getClient()
        .from('conhecimentos')
        .update({ total_chunks: count || 0 })
        .eq('id', conhecimentoId);
    } catch (error) {
      this.logger.error(`Embed and store failed: ${error}`);
      throw error;
    }
  }

  private async evaluateKnowledge(conhecimentoId: string): Promise<{
    o_que_ja_sabemos: string;
    o_que_ainda_falta_descobrir: string | null;
    percentual_conclusao: number;
  }> {
    // Get all chunks for this knowledge base
    const { data: chunks } = await this.supabaseService
      .getClient()
      .from('conhecimento_chunks')
      .select('content')
      .eq('conhecimento_id', conhecimentoId)
      .order('created_at', { ascending: true });

    const allContent = (chunks || []).map((c) => c.content).join('\n\n');

    const response = await this.openai.chat.completions.create({
      model: this.CHAT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `<assistant_system_prompt>
  <identidade>
    <papel>Analista de conhecimento empresarial responsável por revisar o banco de informações do cliente e determinar se o conhecimento sobre o negócio está completo ou parcial.</papel>
    <idioma>pt-BR</idioma>
  </identidade>

  <objetivo>
    Ler os dados existentes sobre o negócio do cliente e avaliar se já há conhecimento suficiente para um atendimento autônomo e natural.
    Caso todos os pontos essenciais estejam bem documentados, indicar que o conhecimento está completo.
    Caso contrário, listar de forma clara e objetiva o que ainda falta descobrir.
    Se o cliente informar que determinada informação não se aplica ou não existe, registrar isso como parte do conhecimento e não fazer novas perguntas sobre esse ponto.
  </objetivo>

  <criterios_de_avaliacao>
    O conhecimento é considerado completo se todos os seguintes eixos estiverem claros ou devidamente marcados como inexistentes/não aplicáveis:
    1. Identidade e tipo de negócio.
    2. Produtos ou serviços oferecidos.
    3. Preços ou faixas de valores.
    4. Endereço, contatos e redes sociais (endereço físico, telefone/WhatsApp, e-mails, links/@nomes exatos das redes).
    5. Horários e formas de atendimento.
    6. Estilo de comunicação (formal, simpático, descontraído etc).
    7. Critérios de intervenção humana: regras ou gatilhos que definem quando o atendente humano deve assumir.
    8. Confirmação na base de que os dados estão corretos.
  </criterios_de_avaliacao>

  <formato_de_saida>
    Retorne APENAS um JSON válido:
    {
      "resumo": {
        "o_que_ja_sabemos": "Descrição resumida e organizada do que já foi identificado.",
        "o_que_ainda_falta_descobrir": "Lista objetiva dos pontos pendentes, ou null se completo.",
        "percentual_conclusao": 85
      }
    }
  </formato_de_saida>

  <restricoes>
    • Retornar apenas o JSON.
    • Quando completo, usar null em "o_que_ainda_falta_descobrir".
    • Sempre preencher todos os campos.
    • Se houver qualquer dúvida, prefira listar o que falta.
    • "percentual_conclusao" DEVE ser um número inteiro de 0 a 100 representando o avanço da coleta.
  </restricoes>
</assistant_system_prompt>`,
        },
        {
          role: 'user',
          content: `Analise os dados a seguir e determine se o conhecimento sobre o negócio está completo:\n\n${allContent}`,
        },
      ],
    });

    try {
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      const resumo = parsed.resumo || {};
      
      const pct = parseInt(String(resumo.percentual_conclusao));
      
      return {
        o_que_ja_sabemos: resumo.o_que_ja_sabemos || 'Nenhuma informação coletada ainda.',
        o_que_ainda_falta_descobrir: resumo.o_que_ainda_falta_descobrir || 'Todas as informações básicas.',
        percentual_conclusao: isNaN(pct) ? 0 : pct,
      };
    } catch {
      return {
        o_que_ja_sabemos: 'Análise em andamento.',
        o_que_ainda_falta_descobrir: 'Informações em processamento.',
        percentual_conclusao: 0,
      };
    }
  }

  private async generateNextQuestion(
    conhecimentoId: string,
    knowledgeSummary: {
      o_que_ja_sabemos: string;
      o_que_ainda_falta_descobrir: string | null;
      percentual_conclusao: number;
    },
    lastUserMessage: string,
  ): Promise<{ message: string; isComplete: boolean }> {
    // If knowledge is complete
    if (!knowledgeSummary.o_que_ainda_falta_descobrir || knowledgeSummary.percentual_conclusao === 100) {
      return {
        message: `🎉 **Sua base de conhecimentos está completa e pronta para uso!**\n\nTodas as informações essenciais foram mapeadas com sucesso.\n\nFique à vontade para **continuar conversando** se quiser adicionar mais detalhes, anexar novos arquivos ou até corrigir algo que falamos antes. A base continuará aprendendo!\n\n**O que já sei sobre sua empresa:**\n${knowledgeSummary.o_que_ja_sabemos}`,
        isComplete: true,
      };
    }

    // Get recent messages for context
    const { data: recentMessages } = await this.supabaseService
      .getClient()
      .from('conhecimento_messages')
      .select('role, content')
      .eq('conhecimento_id', conhecimentoId)
      .order('created_at', { ascending: false })
      .limit(10);

    const chatHistory = (recentMessages || [])
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.openai.chat.completions.create({
      model: this.CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: `<assistant_system_prompt>
  <identidade>
    <papel>Assistente de coleta de informações empresariais, responsável por fazer perguntas específicas e contextuais com base nas lacunas identificadas no conhecimento atual.</papel>
    <idioma>pt-BR</idioma>
  </identidade>

  <objetivo>
    Conduzir uma conversa natural, direta e progressiva para preencher as informações faltantes sobre o negócio do cliente.
    Basear-se exclusivamente no conteúdo de <conhecimento_faltante>.
  </objetivo>

  <conhecimento_existente>${knowledgeSummary.o_que_ja_sabemos}</conhecimento_existente>
  <conhecimento_faltante>${knowledgeSummary.o_que_ainda_falta_descobrir}</conhecimento_faltante>

  <logica_conversacional>
    1. Analise semanticamente os tópicos em <conhecimento_faltante>.
    2. Escolha um único item relevante que ainda não tenha sido perguntado.
    3. Formule uma pergunta direta, específica e contextual.
    4. Após cada resposta do cliente, reconheça brevemente ("Certo.", "Anotado.") e formule a próxima pergunta.
    5. Nenhuma saudação ou agradecimento. Nenhum JSON. Uma pergunta por vez.
    6. O encerramento da coleta será tratado por outro agente — este nó apenas pergunta.
  </logica_conversacional>

  <formato_de_saida>
    Gere apenas a mensagem de texto final pronta para exibição.
    Não inclua JSON, metadados, markdown ou observações.
  </formato_de_saida>
</assistant_system_prompt>`,
        },
        ...chatHistory,
      ],
    });

    return {
      message:
        response.choices[0]?.message?.content ||
        'Desculpe, não consegui processar. Pode tentar novamente?',
      isComplete: false,
    };
  }

  private splitTextIntoChunks(text: string, maxChars: number): string[] {
    if (!text || text.length <= maxChars) return [text];

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    let current = '';

    for (const para of paragraphs) {
      if (current.length + para.length + 2 <= maxChars) {
        current += (current ? '\n\n' : '') + para;
      } else {
        if (current) chunks.push(current);
        // If single paragraph is too long, split by sentences
        if (para.length > maxChars) {
          const sentences = para.split(/(?<=[.!?])\s+/);
          current = '';
          for (const sentence of sentences) {
            if (current.length + sentence.length + 1 <= maxChars) {
              current += (current ? ' ' : '') + sentence;
            } else {
              if (current) chunks.push(current);
              current = sentence;
            }
          }
        } else {
          current = para;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }
}
