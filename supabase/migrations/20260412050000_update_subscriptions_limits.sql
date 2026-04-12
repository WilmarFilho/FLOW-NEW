-- Adds limite_contatos_campanhas and contatos_usados_campanhas to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN limite_contatos_campanhas INT DEFAULT 100,
ADD COLUMN contatos_usados_campanhas INT DEFAULT 0,
ADD COLUMN data_proxima_renovacao TIMESTAMP WITH TIME ZONE;

-- Update existing Freemium users to 500 mensagens limit instead of 1000
UPDATE public.subscriptions
SET limite_mensagens_mensais = 500
WHERE plano = 'freemium' AND limite_mensagens_mensais = 1000;

-- Drop and recreate the handle_new_user trigger function to reflect new limits
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
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
    'admin',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'cidade', ''), 'Não Informada'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'endereco', ''), 'Não Informado'),
    NULLIF(NEW.raw_user_meta_data->>'numero', '')
  );

  -- Insert the base Freemium Subscription Tier
  INSERT INTO public.subscriptions (
    profile_id,
    plano,
    limite_mensagens_mensais,
    limite_contatos_campanhas
  )
  VALUES (
    NEW.id,
    'freemium',
    500,
    100
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC functions to safely increment usage limits
CREATE OR REPLACE FUNCTION increment_mensagens_enviadas(p_profile_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.subscriptions
  SET mensagens_enviadas = mensagens_enviadas + 1
  WHERE profile_id = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION increment_contatos_campanhas(p_profile_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.subscriptions
  SET contatos_usados_campanhas = contatos_usados_campanhas + 1
  WHERE profile_id = p_profile_id;
$$;

