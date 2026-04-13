import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ProfileService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canRequestPasswordReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('E-mail é obrigatório.');
    }

    const supabase = this.supabaseService.getClient();
    const { data: profile, error } = await supabase
      .from('profile')
      .select('tipo_de_usuario')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      allowed: profile?.tipo_de_usuario !== 'atendente',
    };
  }

  async updateProfile(userId: string, updateData: Record<string, unknown>) {
    const supabase = this.supabaseService.getClient();

    const { data: userProfile } = await supabase
      .from('profile')
      .select('tipo_de_usuario')
      .eq('auth_id', userId)
      .single();

    const isAtendente = userProfile?.tipo_de_usuario === 'atendente';

    const allowedUpdates: Record<string, unknown> = {};
    let fields = [
      'nome_completo',
      'cidade',
      'endereco',
      'numero',
      'mostra_nome_mensagens',
      'agendamento_automatico_ia',
      'alerta_atendentes_intervencao_ia',
    ];

    if (isAtendente) {
      fields = fields.filter(
        (f) => !['numero', 'agendamento_automatico_ia', 'alerta_atendentes_intervencao_ia'].includes(f)
      );
    }

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        allowedUpdates[field] = updateData[field];
      }
    });

    const { error } = await supabase
      .from('profile')
      .update(allowedUpdates)
      .eq('auth_id', userId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true };
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const supabase = this.supabaseService.getClient();

    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;

    // Upload to 'avatars' bucket
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new InternalServerErrorException(
        'Failed to upload avatar: ' + uploadError.message,
      );
    }

    // Get public URL
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    // Update profile
    const { error: updateError } = await supabase
      .from('profile')
      .update({ foto_perfil: publicUrl })
      .eq('auth_id', userId);

    if (updateError) {
      throw new InternalServerErrorException(
        'Failed to update profile avatar: ' + updateError.message,
      );
    }

    return { foto_perfil: publicUrl };
  }
}
