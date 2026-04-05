import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ContatosService {
  private readonly logger = new Logger(ContatosService.name);

  constructor(private readonly supabase: SupabaseService) {}

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

  async getAllContatos(authId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('contatos')
      .select('*')
      .eq('profile_id', effectiveAdminId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching contatos', error);
      throw error;
    }
    return data;
  }

  async createContato(authId: string, payload: { nome: string; whatsapp: string }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

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
      this.logger.error('Error creating contato', error);
      throw error;
    }

    return data;
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
      this.logger.error('Error attaching contact to list', error);
      throw error;
    }

    return { success: true };
  }

  async desvincularContato(authId: string, payload: { contatoId: string; listaId: string }) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    // Verify contact belongs to user
    const { data: contact } = await client.from('contatos').select('id').eq('id', payload.contatoId).eq('profile_id', effectiveAdminId).single();
    if (!contact) throw new Error('Contatos não encontrados ou sem permissão');

    const { error } = await client
      .from('contatos_listas_rel')
      .delete()
      .eq('contato_id', payload.contatoId)
      .eq('lista_id', payload.listaId);

    if (error) {
      this.logger.error('Error removing contact from list', error);
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
      this.logger.error('Error fetching listas', listsError);
      throw listsError;
    }

    let finalLists = listas;

    // Auto-create default lists if user has none
    if (!finalLists || finalLists.length === 0) {
      const defaultLists = [
        { profile_id: effectiveAdminId, nome: 'Frio', cor: '#3b82f6', ordem: 1, is_fixed: true },
        { profile_id: effectiveAdminId, nome: 'Quente', cor: '#f97316', ordem: 2, is_fixed: true },
        { profile_id: effectiveAdminId, nome: 'Qualificado', cor: '#22c55e', ordem: 3, is_fixed: true },
      ];

      const { data: newLists, error: createError } = await client
        .from('contatos_listas')
        .insert(defaultLists)
        .select('*');

      if (createError) {
        this.logger.error('Error creating default listas', createError);
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
        contatos:contato_id ( id, nome, whatsapp, avatar_url )
      `)
      .in('lista_id', finalLists.map(l => l.id))
      .order('ordem_kanban', { ascending: true });

    if (relsError) {
      this.logger.error('Error fetching list relationships', relsError);
      throw relsError;
    }

    // Map relationships to lists
    return finalLists.map(list => {
      const cards = rels
        .filter(r => r.lista_id === list.id)
        .map(r => ({
          ...r.contatos,
          ordem_kanban: r.ordem_kanban,
        }))
        .sort((a, b) => a.ordem_kanban - b.ordem_kanban);
      
      return {
        ...list,
        cards,
      };
    });
  }

  async createLista(authId: string, payload: { nome: string; cor: string }) {
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
          nome: payload.nome,
          cor: payload.cor,
          ordem: nextOrder,
          is_fixed: false,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async setContactLists(authId: string, contatoId: string, listaIds: string[]) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();
    
    const { data: contact } = await client.from('contatos').select('id').eq('id', contatoId).eq('profile_id', effectiveAdminId).single();
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
    
    const { data: contact } = await client.from('contatos').select('id').eq('id', contatoId).eq('profile_id', effectiveAdminId).single();
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
       this.logger.error('Error moving contact', error);
       throw error;
    }

    return { success: true };
  }

  async deleteContact(authId: string, contatoId: string) {
    const effectiveAdminId = await this.getEffectiveAdminId(authId);
    const client = this.supabase.getClient();

    const { error } = await client
      .from('contatos')
      .delete()
      .eq('id', contatoId)
      .eq('profile_id', effectiveAdminId);

    if (error) {
       this.logger.error('Error deleting contact', error);
       throw error;
    }

    return { success: true };
  }
}
