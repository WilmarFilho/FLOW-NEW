import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAtendenteDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'O nome completo deve ter no mínimo 3 caracteres.' })
  nome_completo?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatsapp_ids?: string[];
}
