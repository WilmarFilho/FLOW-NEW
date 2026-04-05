import type { Metadata } from 'next';
import HomePage from '@/components/home/HomePage';
import styles from '../ProtectedPage.module.css';

export const metadata: Metadata = {
  title: 'Home | FLOW',
  description: 'Acompanhe o resumo executivo da operação da plataforma.',
};

export default function HomeRoute() {
  return (
    <main className={styles.page}>
      <HomePage />
    </main>
  );
}
