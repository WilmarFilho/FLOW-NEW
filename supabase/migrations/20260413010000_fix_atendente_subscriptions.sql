-- Atendentes herdam a subscription do admin e não devem ter registro próprio
DELETE FROM public.subscriptions s
USING public.profile p
WHERE s.profile_id = p.auth_id
  AND p.tipo_de_usuario = 'atendente';

-- Recria o trigger de novos usuários preservando o papel informado
-- e evitando criar subscription para atendentes.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_tipo TEXT;
BEGIN
  v_tipo := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_de_usuario', ''), 'admin');

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

  IF v_tipo <> 'atendente' THEN
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
