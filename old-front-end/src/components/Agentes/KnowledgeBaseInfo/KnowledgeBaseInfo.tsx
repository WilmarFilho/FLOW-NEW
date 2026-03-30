// Libs
import Styles from './KnowledgeBaseInfo.module.css';
// Icon
import Icon from '../../Gerais/Icons/Icons';
import { Rag } from '@/types/agent';

interface KnowledgeBaseInfoProps {
  status: Rag | null;
}

export default function KnowledgeBaseInfo({ status }: KnowledgeBaseInfoProps) {
  // Define progresso: Ótimo = 100%, Vazio = 0%

  const progresso =
    status?.status_conhecimento === 'Ótimo'
      ? 100
      : status?.status_conhecimento === 'Vazio'
        ? 100
        : 0;

  // Função para baixar o resumo como .txt
  const handleDownloadResumo = () => {
    if (!status?.resumo) return;
    const blob = new Blob([status.resumo], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resumo_base_conhecimento.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={Styles.columnTitlesConhecimento}>
      <h4>Sua base de conhecimento é o coração da automação</h4>

      <div className={Styles.wrapperBody}>
        <div className={Styles.progressBarAgent}>
          <div
            className={`${Styles.progressFill} ${status?.status_conhecimento === 'Ótimo'
              ? Styles.otimo
              : status?.status_conhecimento === 'Vazio'
                ? Styles.vazio
                : ''
              }`}
            style={{ width: '100%' }}
          >
            <span className={Styles.progressPercent}>
              {status?.status_conhecimento === 'Ótimo'
                ? `${progresso}% completa`
                : status?.status_conhecimento === 'Vazio'
                  ? 'Base vazia, contacte o suporte'
                  : `${progresso}% completa`
              }
            </span>
          </div>
        </div>


      </div>

      <div className={Styles.wrapperDownload}>
        <div className={Styles.contentActions}>
          <button onClick={handleDownloadResumo}>
            <Icon nome='downloadtext' />
          </button>
        </div>

        <p>
          Aqui reunimos tudo que a nossa IA sabe sobre o seu negócio. É a partir dessas
          informações que ela responde com precisão aos seus clientes. Mantenha-a atualizada
          para garantir que cada interação seja fiel à sua marca.
        </p>
      </div>

    </div>
  );
}