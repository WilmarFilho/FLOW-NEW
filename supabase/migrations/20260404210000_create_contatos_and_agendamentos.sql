-- 1. TABELA DE CONTATOS
CREATE TABLE IF NOT EXISTS public.contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contatos"
  ON public.contatos FOR ALL
  USING (auth.uid() = profile_id);


-- 2. TABELA DE AGENDAMENTOS
-- Link com Contatos e campo google_event_id para espelho no Google Calendar
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  contato_id UUID REFERENCES public.contatos(id) ON DELETE CASCADE, -- É opcional caso no futuro o agendamento não precise de contato
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  data_hora_fim TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado')),
  google_event_id TEXT, -- ID do evento lá no Google Calendar. Útil para 2-way sync ou exclusão.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agendamentos"
  ON public.agendamentos FOR ALL
  USING (auth.uid() = profile_id);


-- ==========================================
-- 3. TRIGGER DE PREVENÇÃO DE CONFLITOS
-- ==========================================

CREATE OR REPLACE FUNCTION public.check_agendamento_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.data_hora_fim IS NULL THEN
     NEW.data_hora_fim := NEW.data_hora + interval '1 hour';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.agendamentos
    WHERE profile_id = NEW.profile_id
      AND (id != NEW.id OR NEW.id IS NULL)
      AND status != 'cancelado'
      AND data_hora < NEW.data_hora_fim
      AND data_hora_fim > NEW.data_hora
  ) THEN
    RAISE EXCEPTION 'Conflito de horário: Já existe um agendamento para este período.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_agendamento_overlap ON public.agendamentos;
CREATE TRIGGER trigger_check_agendamento_overlap
BEFORE INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.check_agendamento_overlap();
