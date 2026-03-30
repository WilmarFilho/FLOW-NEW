import type { IconProps } from '../../components/Gerais/Icons/Icons';

export interface MenuItem {
  key: string;
  to: string;
  label: string;
  icon: IconProps['nome'];
  roles: Array<'admin' | 'atendente'>;
  section: 'principal' | 'suporte';
  planos?: Array<'basico' | 'intermediario' | 'premium'>; // planos permitidos
}

export const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    to: '/dashboard',
    label: 'Resumo',
    icon: 'resumopage',
    roles: ['admin'],
    section: 'principal',
    planos: ['basico', 'intermediario', 'premium'],
  },
  {
    key: 'conversas',
    to: '/conversas',
    label: 'Conversas',
    icon: 'conversaspage',
    roles: ['admin', 'atendente'],
    section: 'principal',
    planos: ['basico', 'intermediario', 'premium'],
  },
  {
    key: 'atendentes',
    to: '/atendentes',
    label: 'Atendentes',
    icon: 'atendentespage',
    roles: ['admin'],
    section: 'principal',
    planos: ['basico', 'intermediario', 'premium'],
  },
  {
    key: 'agentes',
    to: '/agentes',
    label: 'Agentes',
    icon: 'agentespage',
    roles: ['admin'],
    section: 'principal',
    planos: ['intermediario', 'premium'], // não disponível para basico
  },
  {
    key: 'conexoes',
    to: '/conexoes',
    label: 'Conexões',
    icon: 'conexaopage',
    roles: ['admin'],
    section: 'principal',
    planos: ['basico', 'intermediario', 'premium'],
  },
  {
    key: 'configuracoes',
    to: '/configuracoes',
    label: 'Configurações',
    icon: 'configpage',
    roles: ['admin', 'atendente'],
    section: 'suporte',
    planos: ['basico', 'intermediario', 'premium'],
  },
  {
    key: 'cashback',
    to: '/cashback',
    label: 'Recompensas',
    icon: 'recompensapage',
    roles: ['admin'],
    section: 'suporte',
    planos: ['basico', 'intermediario', 'premium'],
  },
  {
    key: 'ajuda',
    to: '/ajuda',
    label: 'Ajuda',
    icon: 'ajudapage',
    roles: ['admin', 'atendente'],
    section: 'suporte',
    planos: ['basico', 'intermediario', 'premium'],
  },
];