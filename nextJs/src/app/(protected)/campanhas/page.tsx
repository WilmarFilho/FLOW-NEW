import { Metadata } from 'next';
import CampaignsPage from '@/components/campanhas/CampaignsPage';

export const metadata: Metadata = {
  title: 'Campanhas | FLOW',
  description: 'Crie, acompanhe e dispare campanhas de WhatsApp.',
};

export default function CampanhasRoute() {
  return (
    <main className="flex-1 w-full h-full flex flex-col p-4 sm:p-6 overflow-hidden">
      <CampaignsPage />
    </main>
  );
}
