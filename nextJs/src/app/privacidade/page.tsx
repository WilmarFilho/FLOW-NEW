import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidade | FLOW',
  description: 'Política de Privacidade e uso de dados da plataforma FLOW.',
};

export default function PrivacidadePage() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Política de Privacidade</h1>
        <p style={styles.subtitle}>Como coletamos, utilizamos e protegemos seus dados.</p>
      </header>

      <main style={styles.content}>
        <section style={styles.section}>
          <h2>1. Coleta de Informações</h2>
          <p>
            Coletamos informações que você nos fornece diretamente, como nome, e-mail e dados de perfil durante o cadastro. 
            No caso das autorizações OAUTH (como o Google), nós requisitamos apenas os tokens necessários para operar nas permissões as quais o usuário explicitamente consentiu (ver e criar eventos no calendário).
          </p>
        </section>

        <section style={styles.section}>
          <h2>2. Uso das Informações Obtidas</h2>
          <p>
            As informações coletadas e os Tokens de Terceiros (ex: Google Calendar API) são estritamente usados para:
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem', color: '#a1a1aa' }}>
            <li>Criar agendamentos na sua agenda em seu nome quando você finaliza uma marcação no painel.</li>
            <li>Ler seus agendamentos para evitar **conflitos ou marcações duplas**.</li>
            <li>Comunicações oficiais do sistema, caso tenha emitido faturas.</li>
          </ul>
        </section>

        <section style={styles.section}>
          <h2>3. O Que Não Fazemos (Uso restrito da API do Google)</h2>
          <p>
            Em conformidade com a Política de Dados do Usuário dos Serviços de API do Google, garantimos que os dados recebidos das APIs do Google **não serão** utilizados para desenvolver, treinar, melhorar ou alimentar inteligência artificial em modelos de LLM (Nenhum dado é lido do calendário particular de usuários para ensinar IAs da nossa plataforma). As conexões do calendário são isoladas por conta.
          </p>
        </section>

        <section style={styles.section}>
          <h2>4. Segurança e Retenção</h2>
          <p>
            Prezamos por segurança em múltiplas camadas. Todos os tokens do Google são armazenados dentro de infraestruturas seguras com controle de RLS (Nível de Segurança por Linha), significando que apenas você e a camada back-end encriptada têm acesso real às suas chaves.
            Você pode revogar as chaves diretamente no painel de &quot;Integrações&quot; da nossa plataforma ou através na sua própria gestão de conta do Google.
          </p>
        </section>

        <div style={styles.footerLink}>
          <Link href="/termos" style={styles.link}>
            &larr; Voltar para os Termos de Serviço
          </Link>
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#09090b',
    color: '#fafafa',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '4rem 2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '3rem',
    maxWidth: '800px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    background: 'linear-gradient(90deg, #fafafa, #a1a1aa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: '1rem',
  },
  content: {
    maxWidth: '800px',
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '3rem',
    backdropFilter: 'blur(10px)',
  },
  section: {
    marginBottom: '2.5rem',
    lineHeight: '1.6',
  },
  link: {
    color: '#06b6d4',
    textDecoration: 'none',
    fontWeight: 600,
  },
  footerLink: {
    marginTop: '2rem',
    paddingTop: '2rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'center' as const,
  }
};
