import Link from 'next/link';

export const metadata = {
  title: 'Termos de Serviço | FLOW',
  description: 'Contrato e Termos de Uso da plataforma.',
};

export default function TermosPage() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Termos de Serviço</h1>
        <p style={styles.subtitle}>Última atualização: Abril de 2026</p>
      </header>

      <main style={styles.content}>
        <section style={styles.section}>
          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e usar a plataforma FLOW, você concorda em cumprir e ser regido por estes
            Termos de Serviço. Se você não concorda com qualquer parte destes termos, você não deve usar nossos serviços.
          </p>
        </section>

        <section style={styles.section}>
          <h2>2. Descrição do Serviço</h2>
          <p>
            O FLOW é uma plataforma de inteligência de conteúdo, agenda e automação guiada por IA, permitindo agendamentos e a gestão de comunicação. 
             Reservamo-nos o direito de modificar, suspender ou descontinuar o serviço a qualquer momento, visando atualizações.
          </p>
        </section>

        <section style={styles.section}>
          <h2>3. Responsabilidades do Usuário</h2>
          <p>
            Você é responsável por manter a confidencialidade das credenciais de sua conta e por todas as atividades que ocorrem sob ela. 
            Você concorda em usar os serviços conectando contas (como o Google Calendar) apenas se tiver autorização legítima sobre estes dados.
          </p>
        </section>

        <section style={styles.section}>
          <h2>4. Uso da Integração Google Calendar</h2>
          <p>
            Se você optar por conectar o Google Calendar, nós solicitaremos permissão explícita para visualizar e criar eventos em seu nome, estritamente de acordo com sua vontade nas ações dentro do sistema.
            Não venderemos nem daremos usos secundários a esses dados. O acesso pode ser revogado a qualquer instante pelo seu painel administrativo.
          </p>
        </section>

        <section style={styles.section}>
          <h2>5. Limitação de Responsabilidade</h2>
          <p>
            Em nenhuma circunstância nossos desenvolvedores serão responsáveis por quaisquer danos indiretos, acidentais ou perda de dados decorrentes da má gestão pessoal de acessos à plataforma.
          </p>
        </section>

        <div style={styles.footerLink}>
          <Link href="/privacidade" style={styles.link}>
            Ler nossa Política de Privacidade &rarr;
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
