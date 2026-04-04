import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ProfileService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async updateProfile(userId: string, updateData: any) {
    const supabase = this.supabaseService.getClient();
    
    // Only allow expected fields
    const allowedUpdates: any = {};
    const fields = [
      'nome_completo', 'cidade', 'endereco', 'numero', 
      'mostra_nome_mensagens', 'notificacao_para_entrar_conversa'
    ];
    
    fields.forEach(f => {
      if (updateData[f] !== undefined) {
        allowedUpdates[f] = updateData[f];
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
      throw new InternalServerErrorException('Failed to upload avatar: ' + uploadError.message);
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
      throw new InternalServerErrorException('Failed to update profile avatar: ' + updateError.message);
    }

    return { foto_perfil: publicUrl };
  }
}
