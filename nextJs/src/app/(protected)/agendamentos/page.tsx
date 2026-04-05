import { Metadata } from 'next';
import AgendamentosPage from '@/components/agendamentos/AgendamentosPage';

export const metadata: Metadata = {
  title: 'Agendamentos | FLOW',
  description: 'Gerencie seu calendário e integrações.',
};

export default function Agendamentos() {
  return <AgendamentosPage />;
}
