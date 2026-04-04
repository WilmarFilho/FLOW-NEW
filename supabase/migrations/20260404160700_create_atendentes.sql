-- Create Atendentes Table
CREATE TABLE public.atendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  profile_id UUID UNIQUE REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for Atendentes
ALTER TABLE public.atendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own atendentes" 
  ON public.atendentes FOR SELECT 
  USING (auth.uid() = admin_id OR auth.uid() = profile_id);

CREATE POLICY "Manage own atendentes" 
  ON public.atendentes FOR ALL 
  USING (auth.uid() = admin_id);

-- Update the handle_new_user function to respect tipo_de_usuario from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  v_tipo := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_de_usuario', ''), 'admin');

  -- Insert the new user's profile with metadata
  INSERT INTO public.profile (
    auth_id,
    foto_perfil,
    nome_completo,
    tipo_de_usuario,
    cidade,
    endereco,
    numero
  )
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'foto_perfil', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome_completo', ''), 'Usuário Novo'),
    v_tipo,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'cidade', ''), 'Não Informada'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'endereco', ''), 'Não Informado'),
    NULLIF(NEW.raw_user_meta_data->>'numero', '')
  );

  -- Atendentes NÃO recebem subscription própria — herdam do admin
  IF v_tipo <> 'atendente' THEN
    INSERT INTO public.subscriptions (
      profile_id,
      plano,
      limite_mensagens_mensais
    )
    VALUES (
      NEW.id,
      'freemium',
      1000
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
