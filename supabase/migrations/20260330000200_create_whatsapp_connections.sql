-- =============================================
-- Tabela: whatsapp_connections
-- Descrição: Conexões WhatsApp via Evolution API
-- =============================================
CREATE TABLE public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  numero TEXT,
  status TEXT CHECK (status IN ('connected', 'disconnected', 'connecting')) DEFAULT 'disconnected',
  instance_name TEXT UNIQUE,
  agente_id UUID NULL REFERENCES public.agentes(id) ON DELETE SET NULL,
  conhecimento_id UUID NULL REFERENCES public.conhecimentos(id) ON DELETE SET NULL,
  ultima_atualizacao TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_instance UNIQUE (user_id, instance_name)
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own connections"
  ON public.whatsapp_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own connections"
  ON public.whatsapp_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own connections"
  ON public.whatsapp_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own connections"
  ON public.whatsapp_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on whatsapp_connections"
  ON public.whatsapp_connections TO service_role
  USING (true) WITH CHECK (true);

-- Habilitar Realtime para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_connections;

-- REPLICA IDENTITY FULL é necessário para que Realtime envie o payload completo no UPDATE
ALTER TABLE public.whatsapp_connections REPLICA IDENTITY FULL;
