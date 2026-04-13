import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AtendentesService {
  constructor(private readonly supabaseService: SupabaseService) { }

  async createAtendente(adminId: string, data: any) {
    const supabase = this.supabaseService.getClient();

    // Check if the caller is an admin
    const { data: adminProfile, error: profileErr } = await supabase
      .from('profile')
      .select('tipo_de_usuario')
      .eq('auth_id', adminId)
      .single();

    if (profileErr || (adminProfile.tipo_de_usuario !== 'admin' && adminProfile.tipo_de_usuario !== 'superadmin')) {
      throw new HttpException('Apenas administradores podem criar atendentes.', HttpStatus.FORBIDDEN);
    }

    // Use admin api to create user with email confirm = true automatically
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome_completo: data.nome_completo,
        tipo_de_usuario: 'atendente',
      }
    });

    if (createErr) {
      if (createErr.status === 422 || createErr.message.includes('already registered')) {
        throw new HttpException('O e-mail informado já está cadastrado na plataforma.', HttpStatus.CONFLICT);
      }
      throw new HttpException(createErr.message, HttpStatus.BAD_REQUEST);
    }

    // Link in atendentes table
    const { error: linkErr } = await supabase
      .from('atendentes')
      .insert({
        admin_id: adminId,
        profile_id: newUser.user.id,
        numero: data.numero || null,
        whatsapp_ids: data.whatsapp_ids || []
      });

    if (linkErr) {
      // Need to rollback user creation
      await supabase.auth.admin.deleteUser(newUser.user.id);
      throw new HttpException('Erro ao associar atendente no banco.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return { success: true, user: newUser.user };
  }

  async updateAtendente(adminId: string, id: string, data: any) {
    const supabase = this.supabaseService.getClient();

    // 1. Get the atendente profile_id
    const { data: atendente, error: getErr } = await supabase
      .from('atendentes')
      .select('profile_id')
      .eq('id', id)
      .eq('admin_id', adminId)
      .single();

    if (getErr || !atendente) {
      throw new HttpException('Atendente não encontrado ou sem permissão.', HttpStatus.NOT_FOUND);
    }

    // 2. Update Auth (Password if provided, and Metadata)
    const updatePayload: any = {
      user_metadata: {
        nome_completo: data.nome_completo,
      }
    };
    if (data.password) updatePayload.password = data.password;

    const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(
      atendente.profile_id,
      updatePayload
    );

    if (authUpdateErr) {
      throw new HttpException('Erro ao atualizar dados de acesso.', HttpStatus.BAD_REQUEST);
    }

    // 3. Update Profile Name (if changed)
    await supabase
      .from('profile')
      .update({ nome_completo: data.nome_completo })
      .eq('auth_id', atendente.profile_id);

    // 4. Update WhatsApp IDs in atendentes table
    const { error: updateLinkErr } = await supabase
      .from('atendentes')
      .update({
        numero: data.numero || null,
        whatsapp_ids: data.whatsapp_ids || []
      })
      .eq('id', id);

    if (updateLinkErr) {
      throw new HttpException('Erro ao atualizar vínculos de WhatsApp.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return { success: true };
  }

  async deleteAtendente(adminId: string, id: string) {
    const supabase = this.supabaseService.getClient();

    const { data: atendente, error: getErr } = await supabase
      .from('atendentes')
      .select('profile_id')
      .eq('id', id)
      .eq('admin_id', adminId)
      .single();

    if (getErr || !atendente) {
      throw new HttpException('Atendente não encontrado.', HttpStatus.NOT_FOUND);
    }

    // Auth delete (also deletes profile if cascade is set in DB, but usually we handle it)
    await supabase.auth.admin.deleteUser(atendente.profile_id);

    // The profile delete will be handled by Cascade if the FK is set.
    // Explicitly delete from atendentes table just in case
    await supabase.from('atendentes').delete().eq('id', id);

    return { success: true };
  }

  async listAtendentes(adminId: string) {
    const supabase = this.supabaseService.getClient();


    const { data, error } = await supabase
      .from('atendentes')
      .select(`
        id,
        created_at,
        numero,
        whatsapp_ids,
        profile!profile_id (
          auth_id,
          nome_completo,
          foto_perfil,
          status
        )
      `)
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }

    // Hydrate emails from auth.users via Admin API
    if (data && data.length > 0) {
      await Promise.all(data.map(async (atendente) => {
        const profile = Array.isArray(atendente.profile) ? atendente.profile[0] : atendente.profile;
        if (profile && (profile as any).auth_id) {
          const { data: userData } = await supabase.auth.admin.getUserById((profile as any).auth_id);
          if (userData && userData.user) {
            (profile as any).email = userData.user.email;
          }
        }
      }));
    }

    return data;
  }

}
