import { useConfiguracoesPage } from '../hooks/pages/useConfiguracoesPage';
import TabsHeader from '../components/Configuracoes/TabsHeader/TabsHeader';
import SettingsContent from '../components/Configuracoes/SettingsContent/SettingsContent';
import GlobalStyles from '../global.module.css';

export default function ConfiguracoesPage() {

  const { activeTab, tabs, setActiveTab } = useConfiguracoesPage();

  return (
    <div className={GlobalStyles.pageContainer}>
      <TabsHeader tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
      <SettingsContent tabIndex={activeTab} />
    </div>
  );
}