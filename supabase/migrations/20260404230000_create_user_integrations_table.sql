-- Criação da tabela para armazenar os tokens de integrações (como o Google Calendar) isoladamente do Profile.
CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  provider_account_email TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(profile_id, provider)
);

-- Ativar RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- O usuário só pode ver suas próprias integrações
CREATE POLICY "View own integrations" 
  ON public.user_integrations FOR SELECT 
  USING (auth.uid() = profile_id);

-- O usuário pode atualizar ou deletar suas próprias integrações
CREATE POLICY "Update own integrations" 
  ON public.user_integrations FOR UPDATE 
  USING (auth.uid() = profile_id);

CREATE POLICY "Delete own integrations" 
  ON public.user_integrations FOR DELETE 
  USING (auth.uid() = profile_id);

-- E políticas para as APIS/Triggers que usarem a ROLE PostgREST
CREATE POLICY "Insert own integrations" 
  ON public.user_integrations FOR INSERT 
  WITH CHECK (auth.uid() = profile_id);

-- Função simples de atualização de updated_at para a tabela
CREATE TRIGGER on_integration_updated
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);
