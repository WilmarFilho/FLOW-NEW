import type { Metadata } from 'next';
import ConversationsPage from '@/components/conversas/ConversationsPage';
import styles from '../ProtectedPage.module.css';

export const metadata: Metadata = {
  title: 'Conversas | FLOW',
  description: 'Atenda chats do WhatsApp com acompanhamento em tempo real.',
};

export default function ConversasRoute() {
  return (
    <main className={styles.page}>
      <ConversationsPage />
    </main>
  );
}
