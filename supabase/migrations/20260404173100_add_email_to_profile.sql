-- Adiciona a coluna email na tabela profile
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS email TEXT;

-- Atualiza os perfis existentes com os emails do auth.users
UPDATE public.profile p
SET email = u.email
FROM auth.users u
WHERE p.auth_id = u.id AND p.email IS NULL;

-- Atualiza a função handle_new_user para sincronizar o email automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  v_tipo := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_de_usuario', ''), 'admin');

  -- Insert the new user's profile with metadata and email
  INSERT INTO public.profile (
    auth_id,
    email,
    foto_perfil,
    nome_completo,
    tipo_de_usuario,
    cidade,
    endereco,
    numero
  )
  VALUES (
    NEW.id,
    NEW.email,
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
