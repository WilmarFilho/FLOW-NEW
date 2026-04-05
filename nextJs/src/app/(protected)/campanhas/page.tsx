import { Metadata } from 'next';
import CampaignsPage from '@/components/campanhas/CampaignsPage';
import styles from '../ProtectedPage.module.css';

export const metadata: Metadata = {
  title: 'Campanhas | FLOW',
  description: 'Crie, acompanhe e dispare campanhas de WhatsApp.',
};

export default function CampanhasRoute() {
  return (
    <main className={styles.page}>
      <CampaignsPage />
    </main>
  );
}
