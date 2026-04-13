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
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_de_usuario', ''), 'admin'),
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
