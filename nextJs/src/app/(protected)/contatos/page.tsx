import { Metadata } from 'next';
import ContatosClient from './contatos.client';

export const metadata: Metadata = {
  title: 'Contatos | CRM - NKW FLOW',
  description: 'Gerencie seus contatos e leads via CRM Kanban.',
};

export default function ContatosPage() {
  return (
    <main className="flex-1 w-full h-full flex flex-col p-4 sm:p-6 overflow-hidden">
      {/* Client Component that handles logic and views */}
      <ContatosClient />
    </main>
  );
}
