import crypto from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LogsService } from '../logs/logs.service';
import { SupabaseService } from '../supabase/supabase.service';

type QualificationJobState = {
  currentContactName: string | null;
  error: string | null;
  finishedAt: string | null;
  id: string;
  ownerId: string;
  processed: number;
  resultsByList: Array<{
    count: number;
    listId: string;
    listName: string;
  }>;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
  total: number;
  unqualifiedNoConversation: number;
  unqualifiedNoMatch: number;
};

@Injectable()
export class ContatosService {
  private readonly logger = new Logger(ContatosService.name);
  private readonly openai: OpenAI | null;
  private readonly qualificationJobs = new Map<string, QualificationJobState>();
  private readonly runningQualificationByUser = new Map<string, string>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    private readonly logsService: LogsService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  private unwrapRelation<T>(value: T | T[] | null | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }

  private async getEffectiveAdminId(authId: string): Promise<string> {
    const client = this.supabase.getClient();
    const { data: profile } = await client
      .from('profile')
      .select('tipo_de_usuario')
      .eq('auth_id', authId)
      .single();
    
    if (profile?.tipo_de_usuario === 'atendente') {
      const { data: atendente } = await client
        .from('atendentes')
        .select('admin_id')
        .eq('profile_id', authId)
        .single();
      
      if (atendente) return atendente.admin_id;
    }
    
    return authId;
  }

  async startAutomaticQualification(authId: string) {
    if (!this.openai) {
      throw new BadRequestException(
        'A qualificação automática precisa da configuração da OpenAI no backend.',
      );
    }

    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const runningJobId = this.runningQualificationByUser.get(effectiveAdminId);

    if (runningJobId) {
      return this.getAutomaticQualificationStatus(authId, runningJobId);
    }

    const contacts = await this.getUnqualifiedContacts(effectiveAdminId);
    const describedLists = await this.getDescribedLists(effectiveAdminId);

    if (!describedLists.length) {
      throw new BadRequestException(
        'Cadastre ao menos uma lista com descrição para usar a qualificação automática.',
      );
    }

    const job: QualificationJobState = {
      currentContactName: null,
      error: null,
      finishedAt: null,
      id: crypto.randomUUID(),
      ownerId: effectiveAdminId,
      processed: 0,
      resultsByList: describedLists.map((list) => ({
        count: 0,
        listId: list.id,
        listName: list.nome,
      })),
      startedAt: new Date().toISOString(),
      status: 'running',
      total: contacts.length,
      unqualifiedNoConversation: 0,
      unqualifiedNoMatch: 0,
    };

    this.qualificationJobs.set(job.id, job);
    this.runningQualificationByUser.set(effectiveAdminId, job.id);

    void this.processAutomaticQualificationJob(
      effectiveAdminId,
      contacts,
      describedLists,
      job.id,
    );

    return this.serializeQualificationJob(job);
  }

  async getAutomaticQualificationStatus(authId: string, jobId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const job = this.qualificationJobs.get(jobId);

    if (!job || job.ownerId !== effectiveAdminId) {
      throw new NotFoundException('Job de qualificação não encontrado.');
    }

    return this.serializeQualificationJob(job);
  }

  async getAllContatos(authId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('contatos')
      .select('*')
      .eq('profile_id', effectiveAdminId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      await this.logsService.error({
        action: 'contatos.getAllContatos',
        context: ContatosService.name,
        error,
        message: 'Error fetching contatos',
        user_id: effectiveAdminId,
      });
      throw error;
    }
    return data;
  }

  async createContato(authId: string, payload: { nome: string; whatsapp: string }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('contatos')
      .select('*')
      .eq('profile_id', effectiveAdminId)
      .eq('whatsapp', payload.whatsapp)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const { data: deletedExisting } = await client
      .from('contatos')
      .select('*')
      .eq('profile_id', effectiveAdminId)
      .eq('whatsapp', payload.whatsapp)
      .not('deleted_at', 'is', null)
      .maybeSingle();

    if (deletedExisting) {
      const { data: restored, error: restoreError } = await client
        .from('contatos')
        .update({
          nome: payload.nome,
          deleted_at: null,
        })
        .eq('id', deletedExisting.id)
        .select()
        .single();

      if (restoreError) {
        await this.logsService.error({
          action: 'contatos.createContato.restore',
          context: ContatosService.name,
          error: restoreError,
          message: 'Error restoring contato',
          user_id: effectiveAdminId,
        });
        throw restoreError;
      }

      return restored;
    }

    const { data, error } = await client
      .from('contatos')
      .insert([{
        profile_id: effectiveAdminId,
        nome: payload.nome,
        whatsapp: payload.whatsapp
      }])
      .select()
      .single();

    if (error) {
      await this.logsService.error({
        action: 'contatos.createContato',
        context: ContatosService.name,
        error,
        message: 'Error creating contato',
        user_id: effectiveAdminId,
      });
      throw error;
    }

    return data;
  }

  async updateContato(authId: string, contatoId: string, payload: { nome: string }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const nextName = payload.nome?.trim();

    if (!nextName) {
      throw new Error('Informe o nome do contato.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('contatos')
      .update({
        nome: nextName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contatoId)
      .eq('profile_id', effectiveAdminId)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error || !data) {
      await this.logsService.error({
        action: 'contatos.updateContato',
        context: ContatosService.name,
        error,
        message: 'Error updating contato',
        metadata: { contatoId },
        user_id: effectiveAdminId,
      });
      throw error || new Error('Contato não encontrado.');
    }

    return data;
  }

  async getContatoDetails(authId: string, contatoId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    const { data: contact, error: contactError } = await client
      .from('contatos')
      .select('id, nome, whatsapp, avatar_url, created_at')
      .eq('id', contatoId)
      .eq('profile_id', effectiveAdminId)
      .is('deleted_at', null)
      .single();

    if (contactError || !contact) {
      throw contactError || new Error('Contato não encontrado.');
    }

    const { data: presences, error: presenceError } = await client
      .from('contatos_whatsapp_connections')
      .select(`
        id,
        first_seen_at,
        last_seen_at,
        whatsapp_connections:whatsapp_connection_id (
          id,
          nome,
          numero,
          status,
          cor,
          deleted_at
        )
      `)
      .eq('profile_id', effectiveAdminId)
      .eq('contato_id', contatoId)
      .order('last_seen_at', { ascending: false });

    if (presenceError) {
      throw presenceError;
    }

    return {
      ...contact,
      connections: (presences || []).map((presence) => {
        const connection = this.unwrapRelation<any>(presence.whatsapp_connections);

        return {
          first_seen_at: presence.first_seen_at,
          id: presence.id,
          last_seen_at: presence.last_seen_at,
          whatsapp_connection: connection
            ? {
                ...connection,
                status: connection.deleted_at ? 'deleted' : connection.status,
              }
            : null,
        };
      }),
    };
  }

  async vincularContato(authId: string, payload: { contatoId: string; listaId: string }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    // Check if relation already exists
    const { data: existing, error: checkError } = await client
      .from('contatos_listas_rel')
      .select('id')
      .eq('contato_id', payload.contatoId)
      .eq('lista_id', payload.listaId)
      .single();

    if (existing) {
      throw new Error('Contato já está nesta lista');
    }

    // Insert relation
    const { data, error } = await client
      .from('contatos_listas_rel')
      .insert([{
        contato_id: payload.contatoId,
        lista_id: payload.listaId,
        ordem_kanban: 0
      }]);

    if (error) {
      await this.logsService.error({
        action: 'contatos.vincularContato',
        context: ContatosService.name,
        error,
        message: 'Error attaching contact to list',
        metadata: payload,
        user_id: effectiveAdminId,
      });
      throw error;
    }

    return { success: true };
  }

  async desvincularContato(authId: string, payload: { contatoId: string; listaId: string }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    // Verify contact belongs to user
    const { data: contact } = await client.from('contatos').select('id').eq('id', payload.contatoId).eq('profile_id', effectiveAdminId).is('deleted_at', null).single();
    if (!contact) throw new Error('Contatos não encontrados ou sem permissão');

    const { error } = await client
      .from('contatos_listas_rel')
      .delete()
      .eq('contato_id', payload.contatoId)
      .eq('lista_id', payload.listaId);

    if (error) {
      await this.logsService.error({
        action: 'contatos.desvincularContato',
        context: ContatosService.name,
        error,
        message: 'Error removing contact from list',
        metadata: payload,
        user_id: effectiveAdminId,
      });
      throw error;
    }

    return { success: true };
  }

  async getListas(authId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    
    // Fetch user lists
    const { data: listas, error: listsError } = await client
      .from('contatos_listas')
      .select('*')
      .eq('profile_id', effectiveAdminId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (listsError) {
      await this.logsService.error({
        action: 'contatos.getListas',
        context: ContatosService.name,
        error: listsError,
        message: 'Error fetching listas',
        user_id: effectiveAdminId,
      });
      throw listsError;
    }

    let finalLists = listas;

    // Auto-create default lists if user has none
    if (!finalLists || finalLists.length === 0) {
      const defaultLists = [
        {
          profile_id: effectiveAdminId,
          nome: 'Frio',
          cor: '#3b82f6',
          ordem: 1,
          is_fixed: true,
          descricao:
            'Lista para contatos com baixo interesse, sem intenção clara de avançar ou que apenas pediram informações iniciais.',
        },
        {
          profile_id: effectiveAdminId,
          nome: 'Quente',
          cor: '#f97316',
          ordem: 2,
          is_fixed: true,
          descricao:
            'Lista para contatos com intenção clara de avançar, marcar reunião, pedir proposta ou continuar negociação.',
        },
        {
          profile_id: effectiveAdminId,
          nome: 'Qualificado',
          cor: '#22c55e',
          ordem: 3,
          is_fixed: true,
          descricao:
            'Lista para contatos com perfil aderente, contexto claro e potencial real de virar oportunidade.',
        },
      ];

      const { data: newLists, error: createError } = await client
        .from('contatos_listas')
        .insert(defaultLists)
        .select('*');

      if (createError) {
        await this.logsService.error({
          action: 'contatos.getListas.createDefaults',
          context: ContatosService.name,
          error: createError,
          message: 'Error creating default listas',
          user_id: effectiveAdminId,
        });
        throw createError;
      }
      finalLists = newLists.sort((a, b) => a.ordem - b.ordem);
    }

    // Now fetch relationships
    const { data: rels, error: relsError } = await client
      .from('contatos_listas_rel')
      .select(`
        contato_id,
        lista_id,
        ordem_kanban,
          contatos:contato_id ( id, nome, whatsapp, avatar_url, deleted_at )
      `)
      .in('lista_id', finalLists.map(l => l.id))
      .order('ordem_kanban', { ascending: true });

    if (relsError) {
      await this.logsService.error({
        action: 'contatos.getListas.relationships',
        context: ContatosService.name,
        error: relsError,
        message: 'Error fetching list relationships',
        user_id: effectiveAdminId,
      });
      throw relsError;
    }

    // Map relationships to lists
    return finalLists.map(list => {
      const cards = rels
        .map(r => ({
          ...r,
          contato: this.unwrapRelation(r.contatos),
        }))
        .filter(r => r.lista_id === list.id && r.contato && !r.contato.deleted_at)
        .map(r => ({
          ...r.contato,
          ordem_kanban: r.ordem_kanban,
        }))
        .sort((a, b) => a.ordem_kanban - b.ordem_kanban);
      
      return {
        ...list,
        cards,
      };
    });
  }

  async createLista(authId: string, payload: { nome: string; cor: string; descricao?: string | null }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    
    // Get max order
    const { data: listas } = await client
      .from('contatos_listas')
      .select('ordem')
      .eq('profile_id', effectiveAdminId)
      .order('ordem', { ascending: false })
      .limit(1);

    const nextOrder = (listas && listas[0]?.ordem) ? listas[0].ordem + 1 : 1;

    const { data, error } = await client
      .from('contatos_listas')
      .insert([
        {
          profile_id: effectiveAdminId,
          nome: payload.nome.trim(),
          cor: payload.cor,
          descricao: payload.descricao?.trim() || null,
          ordem: nextOrder,
          is_fixed: false,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteLista(authId: string, listaId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    const { data: lista, error: listaError } = await client
      .from('contatos_listas')
      .select('id, is_fixed, profile_id')
      .eq('id', listaId)
      .eq('profile_id', effectiveAdminId)
      .single();

    if (listaError || !lista) {
      throw listaError || new Error('Lista não encontrada.');
    }

    if (lista.is_fixed) {
      throw new Error('Listas padrão do CRM não podem ser excluídas.');
    }

    const { error: relError } = await client
      .from('contatos_listas_rel')
      .delete()
      .eq('lista_id', listaId);

    if (relError) {
      await this.logsService.error({
        action: 'contatos.deleteLista.relationships',
        context: ContatosService.name,
        error: relError,
        message: 'Error deleting contatos_listas_rel',
        metadata: { listaId },
        user_id: effectiveAdminId,
      });
      throw relError;
    }

    const { error: deleteError } = await client
      .from('contatos_listas')
      .delete()
      .eq('id', listaId)
      .eq('profile_id', effectiveAdminId);

    if (deleteError) {
      await this.logsService.error({
        action: 'contatos.deleteLista',
        context: ContatosService.name,
        error: deleteError,
        message: 'Error deleting contatos_listas',
        metadata: { listaId },
        user_id: effectiveAdminId,
      });
      throw deleteError;
    }

    return { success: true };
  }

  async setContactLists(authId: string, contatoId: string, listaIds: string[]) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    
    const { data: contact } = await client.from('contatos').select('id').eq('id', contatoId).eq('profile_id', effectiveAdminId).is('deleted_at', null).single();
    if (!contact) throw new Error('Contatos não encontrados ou sem permissão');

    await client.from('contatos_listas_rel').delete().eq('contato_id', contatoId);

    if (listaIds.length > 0) {
      const inserts = listaIds.map(lis => ({ contato_id: contatoId, lista_id: lis, ordem_kanban: 0 }));
      const { error } = await client.from('contatos_listas_rel').insert(inserts);
      if (error) throw error;
    }

    return { success: true };
  }

  async moveContact(authId: string, contatoId: string, payload: { sourceListId: string, targetListId: string, newOrder: number }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    const { sourceListId, targetListId, newOrder } = payload;
    
    const { data: contact } = await client.from('contatos').select('id').eq('id', contatoId).eq('profile_id', effectiveAdminId).is('deleted_at', null).single();
    if (!contact) throw new Error('Contatos não encontrados ou sem permissão');

    if (sourceListId && sourceListId !== targetListId) {
      await client.from('contatos_listas_rel').delete().eq('contato_id', contatoId).eq('lista_id', sourceListId);
    }

    const { error } = await client
      .from('contatos_listas_rel')
      .upsert({
        contato_id: contatoId,
        lista_id: targetListId,
        ordem_kanban: newOrder
      });
      
    if (error) {
       await this.logsService.error({
         action: 'contatos.moveContact',
         context: ContatosService.name,
         error,
         message: 'Error moving contact',
         metadata: { contatoId, ...payload },
         user_id: effectiveAdminId,
       });
       throw error;
    }

    return { success: true };
  }

  private async processAutomaticQualificationJob(
    effectiveAdminId: string,
    contacts: Array<{ id: string; nome: string; whatsapp: string | null }>,
    describedLists: Array<{ descricao: string; id: string; nome: string }>,
    jobId: string,
  ) {
    const job = this.qualificationJobs.get(jobId);
    if (!job) {
      return;
    }

    try {
      for (const contact of contacts) {
        job.currentContactName = contact.nome;
        const transcript = await this.buildContactQualificationTranscript(
          effectiveAdminId,
          contact.id,
        );

        if (!transcript) {
          job.unqualifiedNoConversation += 1;
          job.processed += 1;
          continue;
        }

        const selectedListId = await this.classifyContactIntoList(
          contact.nome,
          describedLists,
          transcript,
        );

        if (!selectedListId) {
          job.unqualifiedNoMatch += 1;
          job.processed += 1;
          continue;
        }

        await this.attachContactToListIfNeeded(contact.id, selectedListId);
        const summaryItem = job.resultsByList.find((item) => item.listId === selectedListId);
        if (summaryItem) {
          summaryItem.count += 1;
        }
        job.processed += 1;
      }

      job.currentContactName = null;
      job.finishedAt = new Date().toISOString();
      job.status = 'completed';
    } catch (error) {
      await this.logsService.error({
        action: 'contatos.automaticQualification',
        context: ContatosService.name,
        error,
        message: 'Erro ao processar qualificação automática',
        metadata: { jobId },
        user_id: effectiveAdminId,
      });
      job.currentContactName = null;
      job.error = error instanceof Error ? error.message : 'Erro inesperado na qualificação.';
      job.finishedAt = new Date().toISOString();
      job.status = 'failed';
    } finally {
      this.runningQualificationByUser.delete(effectiveAdminId);
    }
  }

  private async getDescribedLists(effectiveAdminId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('contatos_listas')
      .select('id, nome, descricao')
      .eq('profile_id', effectiveAdminId)
      .not('descricao', 'is', null)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).filter((list) => list.descricao?.trim());
  }

  private async getUnqualifiedContacts(effectiveAdminId: string) {
    const client = this.supabase.getClient();
    const { data: contacts, error } = await client
      .from('contatos')
      .select('id, nome, whatsapp')
      .eq('profile_id', effectiveAdminId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!contacts?.length) {
      return [];
    }

    const { data: relations, error: relError } = await client
      .from('contatos_listas_rel')
      .select('contato_id')
      .in(
        'contato_id',
        contacts.map((contact) => contact.id),
      );

    if (relError) {
      throw relError;
    }

    const linkedIds = new Set((relations || []).map((relation) => relation.contato_id));
    return contacts.filter((contact) => !linkedIds.has(contact.id));
  }

  private async buildContactQualificationTranscript(
    effectiveAdminId: string,
    contactId: string,
  ) {
    const client = this.supabase.getClient();
    const { data: conversations, error: conversationsError } = await client
      .from('conversas')
      .select('id, last_message_at')
      .eq('profile_id', effectiveAdminId)
      .eq('contato_id', contactId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false });

    if (conversationsError) {
      throw conversationsError;
    }

    if (!conversations?.length) {
      return null;
    }

    const { data: messages, error: messagesError } = await client
      .from('conversas_mensagens')
      .select('direction, sender_type, content, ai_context_text, message_type, created_at')
      .in(
        'conversa_id',
        conversations.map((conversation) => conversation.id),
      )
      .neq('direction', 'system')
      .order('created_at', { ascending: false })
      .limit(60);

    if (messagesError) {
      throw messagesError;
    }

    const normalizedMessages = [...(messages || [])]
      .reverse()
      .map((message) => {
        const content = message.ai_context_text?.trim() || message.content?.trim() || null;
        if (!content) {
          return null;
        }

        const role =
          message.direction === 'inbound' || message.sender_type === 'customer'
            ? 'Cliente'
            : 'Equipe';

        return `[${role}] ${content}`;
      })
      .filter((message): message is string => Boolean(message));

    if (!normalizedMessages.length) {
      return null;
    }

    return normalizedMessages.join('\n').slice(0, 8000);
  }

  private async classifyContactIntoList(
    contactName: string,
    describedLists: Array<{ descricao: string; id: string; nome: string }>,
    transcript: string,
  ) {
    if (!this.openai) {
      return null;
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Você classifica contatos em listas de CRM.
Analise somente o que o cliente demonstrou nas conversas.
Escolha no máximo uma lista.
Só selecione uma lista quando houver evidência clara no histórico.
Se não houver histórico suficiente ou aderência clara, retorne null.
Responda JSON no formato:
{
  "listId": "uuid-ou-null",
  "reason": "motivo curto"
}`,
        },
        {
          role: 'user',
          content: `Contato: ${contactName}

Listas disponíveis:
${describedLists
  .map(
    (list) =>
      `- ${list.id} | ${list.nome}: ${list.descricao}`,
  )
  .join('\n')}

Histórico de conversa:
${transcript}`,
        },
      ],
    });

    try {
      const parsed = JSON.parse(
        response.choices[0]?.message?.content || '{"listId":null}',
      ) as { listId?: string | null };

      if (!parsed.listId) {
        return null;
      }

      return describedLists.some((list) => list.id === parsed.listId)
        ? parsed.listId
        : null;
    } catch (error) {
      await this.logsService.warn({
        action: 'contatos.classifyContactIntoList',
        context: ContatosService.name,
        error,
        message: 'Falha ao interpretar classificação de contato',
      });
      return null;
    }
  }

  private async attachContactToListIfNeeded(contatoId: string, listaId: string) {
    const client = this.supabase.getClient();
    const { data: existing, error: existingError } = await client
      .from('contatos_listas_rel')
      .select('contato_id')
      .eq('contato_id', contatoId)
      .eq('lista_id', listaId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return;
    }

    const { error } = await client.from('contatos_listas_rel').insert({
      contato_id: contatoId,
      lista_id: listaId,
      ordem_kanban: 0,
    });

    if (error) {
      throw error;
    }
  }

  private serializeQualificationJob(job: QualificationJobState) {
    const { ownerId: _ownerId, ...publicJob } = job;
    return publicJob;
  }

  async deleteContact(authId: string, contatoId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    const { error } = await client
      .from('contatos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', contatoId)
      .eq('profile_id', effectiveAdminId);

    if (error) {
       await this.logsService.error({
         action: 'contatos.deleteContact',
         context: ContatosService.name,
         error,
         message: 'Error deleting contact',
         metadata: { contatoId },
         user_id: effectiveAdminId,
       });
       throw error;
    }

    return { success: true };
  }
}
