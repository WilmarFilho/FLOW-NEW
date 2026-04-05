import { Metadata } from 'next';
import ContatosClient from './contatos.client';
import styles from '../ProtectedPage.module.css';

export const metadata: Metadata = {
  title: 'Contatos | CRM - NKW FLOW',
  description: 'Gerencie seus contatos e leads via CRM Kanban.',
};

export default function ContatosPage() {
  return (
    <main className={styles.page}>
      {/* Client Component that handles logic and views */}
      <ContatosClient />
    </main>
  );
}
