import ConfiguracoesPage from '@/components/configuracoes/ConfiguracoesPage';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'Configurações | FLOW',
};

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'mock-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Não autorizado</div>;
  }

  // Busca dados iniciais do profile na renderização Server Side para injetar na página cliente
  const { data: profile } = await supabase
    .from('profile')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  let assinanteProfileId = user.id;
  if (profile?.tipo_de_usuario === 'atendente') {
    const { data: atendente } = await supabase
      .from('atendentes')
      .select('admin_id')
      .eq('profile_id', user.id)
      .single();
    if (atendente?.admin_id) assinanteProfileId = atendente.admin_id;
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('profile_id', assinanteProfileId)
    .single();

  const userInitialData = {
    auth_id: user.id,
    assinante_profile_id: assinanteProfileId,
    email: user.email || '',
    nome_completo: profile?.nome_completo || '',
    foto_perfil: profile?.foto_perfil || '',
    tipo_de_usuario: profile?.tipo_de_usuario || 'admin',
    cidade: profile?.cidade || '',
    endereco: profile?.endereco || '',
    numero: profile?.numero || '',
    mostra_nome_mensagens: profile?.mostra_nome_mensagens ?? true,
    agendamento_automatico_ia: profile?.agendamento_automatico_ia ?? true,
    alerta_atendentes_intervencao_ia: profile?.alerta_atendentes_intervencao_ia ?? true,
    plano: sub?.plano || 'freemium',
    mensagens_enviadas: sub?.mensagens_enviadas || 0,
    limite_mensagens_mensais: sub?.limite_mensagens_mensais || 500,
    contatos_usados_campanhas: sub?.contatos_usados_campanhas || 0,
    limite_contatos_campanhas: sub?.limite_contatos_campanhas || 100,
    stripe_customer_id: sub?.stripe_customer_id || null,
  };

  return <ConfiguracoesPage initialData={userInitialData} />;
}
