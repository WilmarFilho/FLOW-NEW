import { Connection } from './connection';
import { User } from './user';

export interface Attendant {
  id: string;
  user_admin_id: string;
  connection_id: string;
  user_id: string;
  user_admin: User;
  connection: Connection;
  user: User;
}

export interface AttendantFormData {
  id?: string;
  user_id: string;
  nome: string;
  password?: string;
  email: string;
  status: boolean;
  numero: string;
  connection_id: string;
}