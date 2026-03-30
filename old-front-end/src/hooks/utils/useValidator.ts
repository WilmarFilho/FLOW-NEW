import { Connection } from '../../types/connection';
import { AttendantFormData } from '../../types/attendant';
import { User } from '@/types/user';

export function validateAttendantForm(data: AttendantFormData, editMode = false) {
  const errors: Partial<Record<keyof AttendantFormData, string>> = {};

  if (!data.nome.trim() || data.nome.trim().length < 3) {
    errors.nome = 'O nome deve ter pelo menos 3 caracteres.';
  }
  if (!data.nome.trim() || data.nome.trim().length > 20) {
    errors.nome = 'O nome deve ter no máximo 20 caracteres.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'E-mail inválido.';
  }

  if (!/^\d{10,11}$/.test(data.numero.trim())) {
    errors.numero = 'Número deve ter 10 ou 11 dígitos.';
  }

  if (!editMode && (!data.password || data.password.length < 6)) {
    errors.password = 'A senha deve ter pelo menos 6 caracteres.';
  }

  if (!data.connection_id) {
    errors.connection_id = 'Selecione uma conexão.';
  }

  return errors;
}

export function validateUserForm(data: Partial<User>) {
  const errors: Partial<Record<keyof User, string>> = {};

  if (!data.nome?.trim() || data.nome.trim().length < 3) {
    errors.nome = 'O nome deve ter pelo menos 3 caracteres.';
  }
  if (!data.nome?.trim() || data.nome.trim().length > 20) {
    errors.nome = 'O nome deve ter no máximo 20 caracteres.';
  }
  if (!data.cidade?.trim() || data.cidade.trim().length < 3) {
    errors.cidade = 'O nome da cidade deve ter pelo menos 3 caracteres.';
  }
  if (!data.endereco?.trim() || data.endereco.trim().length < 3) {
    errors.endereco = 'O nome do endereço deve ter pelo menos 3 caracteres.';
  }
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'E-mail inválido.';
  }
  if (!data.password || data.password.length < 6) {
    errors.password = 'A senha deve ter pelo menos 6 caracteres.';
  }

  return errors;
}

export function validateConnectionForm(data: Partial<Connection> | null, userPlan?: string | null, editMode = false, showQR = false) {
  const errors: Partial<Record<keyof Connection, string>> = {};

  if (!data?.nome || data.nome.trim().length < 3) {
    errors.nome = 'O nome da conexão deve ter ao menos 3 caracteres.';
  }

  if (!data?.nome || data.nome.trim().length > 20) {
    errors.nome = 'O nome da conexão deve ter no máximo 20 caracteres.';
  }

  if (!editMode && !showQR) {
    if (data?.numero && !/^\d{10,12}$/.test(data.numero.trim())) {
      errors.numero = 'Número deve ter 10 ou 11 dígitos.';
    }
    if (!(data?.numero)) {
      errors.numero = 'Número deve ser preenchido para conexão via código.';
    }
  }

  if (userPlan !== 'basico' && (!data?.agente_id || data.agente_id.trim() === '')) {
    errors.agente_id = 'Selecione um agente.';
  }

  return errors;
}