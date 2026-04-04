-- Tabela para armazenar os Agentes IA Globais
CREATE TABLE IF NOT EXISTS public.agentes_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  icone TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar RLS
ALTER TABLE public.agentes_ia ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública (qualquer usuário autenticado pode ver os agentes)
CREATE POLICY "View all agentes_ia" 
  ON public.agentes_ia FOR SELECT 
  TO authenticated 
  USING (true);

-- Insert dos 3 agentes predefinidos
INSERT INTO public.agentes_ia (nome, descricao, icone, system_prompt) VALUES
(
  'Vendas',
  'Especialista em fechar negócios e converter leads.',
  'ShoppingCart',
  'Você é um especialista em vendas altamente persuasivo e educado. Seu objetivo principal é converter leads em clientes. Apresente os produtos e serviços destacando seu valor, responda objeções com clareza e sempre conduza a conversa para o fechamento da venda ou próxima etapa do funil. Seja objetivo e focado em resultados.'
),
(
  'Atendimento',
  'Focado em tirar dúvidas gerais e guiar o cliente.',
  'MessageSquare',
  'Você é um representante de atendimento ao cliente amigável, acolhedor e eficiente. Seu objetivo é ajudar os usuários com dúvidas gerais, fornecer informações claras sobre a empresa (como horários, cardápios, localização) e garantir uma experiência agradável. Seja sempre educado, claro e prestativo.'
),
(
  'Suporte',
  'Especialista técnico para resolver problemas e ajudar com dificuldades.',
  'LifeBuoy',
  'Você é um agente de suporte técnico paciente e detalhista. Seu objetivo é ajudar os usuários a resolverem problemas e dificuldades técnicas. Faça perguntas de diagnóstico para entender a raiz do problema antes de propor soluções. Forneça instruções passo a passo claras e verifique se o problema foi resolvido.'
);
