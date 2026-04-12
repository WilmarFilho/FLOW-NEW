import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Sidebar from '@/components/layout/Sidebar';
import RoleGuard from '@/components/auth/RoleGuard';
import PaywallModal from '@/components/paywall/PaywallModal';
import styles from './layout.module.css';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'mock-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Readonly in Server Component
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Você pode buscar o profile customizado via banco aqui
  const { data: profile } = await supabase
    .from('profile')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  const tipoUsuario = profile?.tipo_de_usuario || 'admin';

  // Busca assinatura
  let assinanteProfileId = user.id;
  
  if (tipoUsuario === 'atendente') {
    const { data: atendente } = await supabase
      .from('atendentes')
      .select('admin_id')
      .eq('profile_id', user.id)
      .single();

    if (atendente?.admin_id) {
      assinanteProfileId = atendente.admin_id;
    }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('profile_id', assinanteProfileId)
    .single();

  const planoAtivo = subscription?.plano || 'freemium';
  const usedMessages = subscription?.mensagens_enviadas || 0;
  const maxMessages = subscription?.limite_mensagens_mensais || 500;
  const usedContacts = subscription?.contatos_usados_campanhas || 0;
  const maxContacts = subscription?.limite_contatos_campanhas || 100;

  const hitMessageLimit = usedMessages >= maxMessages;
  const hitContactLimit = usedContacts >= maxContacts;

  let paywallReason = '';
  if (hitMessageLimit) paywallReason = `Você já enviou ${usedMessages} de ${maxMessages} mensagens.`;
  else if (hitContactLimit) paywallReason = `Você já usou ${usedContacts} de ${maxContacts} contatos em campanhas.`;

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'radial-gradient(300.92% 96.88% at 97.01% 12.45%, rgba(13, 13, 13, 0.40) 0%, rgba(14, 17, 38, 0.80) 100%), url("/assets/bgDark.webp") lightgray 50% / cover no-repeat',
      color: '#fff'
    }}>
      <RoleGuard tipoUsuario={tipoUsuario} />
      
      {paywallReason ? (
        <PaywallModal reason={paywallReason} profileId={assinanteProfileId} />
      ) : null}

      <Sidebar user={{
        nome_completo: profile?.nome_completo || user.email?.split('@')[0],
        email: user.email,
        foto_perfil: profile?.foto_perfil,
        plano: planoAtivo,
        tipo_de_usuario: tipoUsuario
      }} />
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
