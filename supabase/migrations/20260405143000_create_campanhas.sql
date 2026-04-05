-- =============================================
-- Tabelas de campanhas de WhatsApp
-- =============================================

CREATE TABLE IF NOT EXISTS public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  whatsapp_connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE RESTRICT,
  lista_id UUID NOT NULL REFERENCES public.contatos_listas(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'failed')),
  total_contatos INTEGER NOT NULL DEFAULT 0,
  enviados_com_sucesso INTEGER NOT NULL DEFAULT 0,
  falhas INTEGER NOT NULL DEFAULT 0,
  pendentes INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campanhas"
  ON public.campanhas FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Service role full access on campanhas"
  ON public.campanhas TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_campanhas_profile_status
  ON public.campanhas (profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campanhas_whatsapp_connection
  ON public.campanhas (whatsapp_connection_id);

CREATE TABLE IF NOT EXISTS public.campanhas_destinatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campanhas_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campanhas destinatarios"
  ON public.campanhas_destinatarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.campanhas
      WHERE campanhas.id = campanhas_destinatarios.campanha_id
        AND campanhas.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own campanhas destinatarios"
  ON public.campanhas_destinatarios FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campanhas
      WHERE campanhas.id = campanhas_destinatarios.campanha_id
        AND campanhas.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own campanhas destinatarios"
  ON public.campanhas_destinatarios FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campanhas
      WHERE campanhas.id = campanhas_destinatarios.campanha_id
        AND campanhas.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campanhas
      WHERE campanhas.id = campanhas_destinatarios.campanha_id
        AND campanhas.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own campanhas destinatarios"
  ON public.campanhas_destinatarios FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.campanhas
      WHERE campanhas.id = campanhas_destinatarios.campanha_id
        AND campanhas.profile_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on campanhas_destinatarios"
  ON public.campanhas_destinatarios TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_campanhas_destinatarios_campanha_status
  ON public.campanhas_destinatarios (campanha_id, status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.campanhas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campanhas_destinatarios;

ALTER TABLE public.campanhas REPLICA IDENTITY FULL;
ALTER TABLE public.campanhas_destinatarios REPLICA IDENTITY FULL;
