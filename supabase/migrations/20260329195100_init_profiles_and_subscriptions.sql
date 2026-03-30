-- Create Profile Table
CREATE TABLE public.profile (
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  foto_perfil TEXT,
  nome_completo TEXT NOT NULL,
  tipo_de_usuario TEXT CHECK (tipo_de_usuario IN ('superadmin', 'admin', 'atendente')) NOT NULL DEFAULT 'admin',
  status BOOLEAN DEFAULT TRUE,
  mostra_nome_mensagens BOOLEAN DEFAULT TRUE,
  notificacao_para_entrar_conversa BOOLEAN DEFAULT TRUE,
  cidade TEXT NOT NULL,
  endereco TEXT NOT NULL,
  numero TEXT
);

-- Turn on RLS for Profile
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own profile" 
  ON public.profile FOR SELECT 
  USING (auth.uid() = auth_id);

CREATE POLICY "Update own profile" 
  ON public.profile FOR UPDATE 
  USING (auth.uid() = auth_id);

-- Create Subscriptions / Freemium / Stripe Table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profile(auth_id) ON DELETE CASCADE,
  plano TEXT CHECK (plano IN ('freemium', 'basico', 'intermediario', 'premium')) DEFAULT 'freemium',
  limite_mensagens_mensais INT DEFAULT 1000,
  mensagens_enviadas INT DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  stripe_status TEXT,
  data_renovacao TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own subscription" 
  ON public.subscriptions FOR SELECT 
  USING (auth.uid() = profile_id);

-- Create Automation Trigger for New Auth Users
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
    limite_mensagens_mensais
  )
  VALUES (
    NEW.id,
    'freemium',
    1000
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on inserts to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
