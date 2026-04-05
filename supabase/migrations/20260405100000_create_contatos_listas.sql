-- 1. TABELA DE LISTAS DO KANBAN
CREATE TABLE IF NOT EXISTS public.contatos_listas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT,
  ordem INTEGER DEFAULT 0,
  is_fixed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.contatos_listas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contatos_listas"
  ON public.contatos_listas FOR ALL
  USING (auth.uid() = profile_id);

-- 2. TABELA RELACIONAMENTO N:N (CONTATOS E LISTAS)
CREATE TABLE IF NOT EXISTS public.contatos_listas_rel (
  contato_id UUID NOT NULL REFERENCES public.contatos(id) ON DELETE CASCADE,
  lista_id UUID NOT NULL REFERENCES public.contatos_listas(id) ON DELETE CASCADE,
  ordem_kanban DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (contato_id, lista_id)
);

ALTER TABLE public.contatos_listas_rel ENABLE ROW LEVEL SECURITY;

-- Note that users manage these relationships through the contatos they own
CREATE POLICY "Users can manage contatos_listas_rel"
  ON public.contatos_listas_rel FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.contatos
      WHERE contatos.id = public.contatos_listas_rel.contato_id
      AND contatos.profile_id = auth.uid()
    )
  );

-- 3. INSERIBILIDADE PARA USUÁRIOS EXISTENTES E NOVOS USUÁRIOS

-- Preencher as listas padrões para todos os perfis que já existem no banco (ignorando atendentes)
INSERT INTO public.contatos_listas (profile_id, nome, cor, ordem, is_fixed)
SELECT auth_id, 'Frio', '#3b82f6', 1, true FROM public.profile p
WHERE p.tipo_de_usuario <> 'atendente' AND NOT EXISTS (
  SELECT 1 FROM public.contatos_listas cl WHERE cl.profile_id = p.auth_id AND cl.nome = 'Frio'
);

INSERT INTO public.contatos_listas (profile_id, nome, cor, ordem, is_fixed)
SELECT auth_id, 'Quente', '#f97316', 2, true FROM public.profile p
WHERE p.tipo_de_usuario <> 'atendente' AND NOT EXISTS (
  SELECT 1 FROM public.contatos_listas cl WHERE cl.profile_id = p.auth_id AND cl.nome = 'Quente'
);

INSERT INTO public.contatos_listas (profile_id, nome, cor, ordem, is_fixed)
SELECT auth_id, 'Qualificado', '#22c55e', 3, true FROM public.profile p
WHERE p.tipo_de_usuario <> 'atendente' AND NOT EXISTS (
  SELECT 1 FROM public.contatos_listas cl WHERE cl.profile_id = p.auth_id AND cl.nome = 'Qualificado'
);

-- Criar a Função e a Trigger para gerar essas listas toda vez que um perfil for criado (automação)
CREATE OR REPLACE FUNCTION public.create_default_contact_lists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo_de_usuario <> 'atendente' THEN
    INSERT INTO public.contatos_listas (profile_id, nome, cor, ordem, is_fixed)
    VALUES 
      (NEW.auth_id, 'Frio', '#3b82f6', 1, true),
      (NEW.auth_id, 'Quente', '#f97316', 2, true),
      (NEW.auth_id, 'Qualificado', '#22c55e', 3, true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_created_create_lists ON public.profile;
CREATE TRIGGER on_profile_created_create_lists
AFTER INSERT ON public.profile
FOR EACH ROW EXECUTE FUNCTION public.create_default_contact_lists();

