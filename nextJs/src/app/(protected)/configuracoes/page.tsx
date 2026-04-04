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

  const userInitialData = {
    auth_id: user.id,
    email: user.email || '',
    nome_completo: profile?.nome_completo || '',
    foto_perfil: profile?.foto_perfil || '',
    tipo_de_usuario: profile?.tipo_de_usuario || 'admin',
    cidade: profile?.cidade || '',
    endereco: profile?.endereco || '',
    numero: profile?.numero || '',
    mostra_nome_mensagens: profile?.mostra_nome_mensagens ?? true,
    notificacao_para_entrar_conversa: profile?.notificacao_para_entrar_conversa ?? true,
  };

  return <ConfiguracoesPage initialData={userInitialData} />;
}
