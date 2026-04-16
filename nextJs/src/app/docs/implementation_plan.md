# Estruturação e Refinamento da Tela de Documentação (Docs)

Este plano visa melhorar a experiência visual da central de ajuda do FLOW e reestruturar os textos explicativos para abranger todas as funcionalidades ativas da plataforma de acordo com a base de código.

## User Review Required

> [!IMPORTANT]  
> Você precisará aprovar os tópicos propostos da documentação e as melhorias no layout. Por favor, analise a lista abaixo (Proposta de Copy) e veja se todas as funcionalidades vitais do FLOW foram contempladas antes de prosseguirmos.

## Proposed Changes

### UI/UX & Animações (`Docs.module.css` e `page.tsx`)
- **Tons e Cores**: Manter o esquema dark mode atual, mas adicionar sutilezas do "Glassmorphism" nos `cards` e na `sidebar`. Estilizar elementos markdown com a identidade da marca.
- **Animações (Micro-interações)**:
  - Adicionar estados de `hover` nas navegações laterais com uma transição suave de `background` e `padding-left`.
  - Aplicar animação de "fade & slide up" ao renderizar o documento ativo.
  - Cards interativos na página inicial farão um de "lift" (elevação) suave, com destaque de bordas.
- **Markdown Renderer**: O renderizador atual é básico. Em vez de criar um parser complexo na mão, estilizaremos as saídas que já cobrem os blocos essenciais (`h1, h2, h3, p, ul, li, blockquote`). Ampliaremos isso para adicionar estilos bacanas de listas, quotes com barra lateral primária, e `code snippets` ou alertas se presentes.

### Estruturação da Copy / Tópicos (`lib/docsData.ts`)

Lendo a base de código (NestJS e módulos existentes no Histórico), o FLOW fornece as seguintes capabilities principais, as quais listaremos e explicaremos como guias:

#### [MODIFY] `c:\dev\FLOW\nextJs\src\lib\docsData.ts`
Implementaremos toda a cópia (os textos reais de ajuda em MarkDown) seguindo esta estrutura:

1. **Começando com o FLOW**
   - **Introdução e Primeiros Passos (`introducao`)**: Visão geral do FLOW (hub de atendimento, automação IA, CRM).
   - **Gerenciando sua Assinatura (`assinaturas`)**: Controle de cotas e como as funcionalidades se comportam perante os paywalls do Stripe.

2. **Atendimento e CRM**
   - **Conexões WhatsApp (`conexoes-whatsapp`)**: Passos para conectar seu número via QR Code, possibilitando interação da IA e de atendentes.
   - **Inbox e Conversas (`inbox-conversas`)**: Como a transbordo de bot para humano atua, e visualização dos chats ao vivo.
   - **Kanban e Gestão de Contatos (`gestao-contatos`)**: Uso do CRM, estágios de funil de vendas, e movimentação de contatos (leads).
   - **Gerenciando Atendentes (`atendentes`)**: Adição de agentes com validações em tempo real e perfis de alertas.

3. **Inteligência Artificial e Automação**
   - **Treinando a IA / Bases de Conhecimento (`bases-conhecimento`)**: Como fazer upload de dados para instruir o agente virtual de maneira isolada (Secure Knowledge Base).
   - **Agendamentos Automáticos (`agendamentos`)**: Configuração para que os Agentes-IA leiam agendas e façam marcação de horários.
   - **Qualificação de Leads (`qualificacao-ia`)**: Como a IA processa intenções dos usuários e encaminha os mesmos no funil / alerta atendentes.

4. **Marketing e Disparo**
   - **Campanhas e Broadcast (`campanhas`)**: Orientações para envios em massa dinâmicos utilizando a API, respeitando o volume do plano adquirido.

## Open Questions

> [!NOTE]
> Você deseja que eu exporte os "markdowns" curados diretamente numa pasta dentro da aplicação (como arquivos `.md` locais lidos em tempo real), ou prefere que eu os escreva dinamicamente como strings literais TS direto no arquivo `docsData.ts` (ou ambos separados por arquivo TypeScript)? Para a complexidade atual, strings TS são mais fáceis.

## Verification Plan

### Manual Verification
- Acessar a URL HTTP local `/docs` do app NextJS após a atualização.
- Navegar na sidebar e certificar-se de a doc de Kanban possui as instruções do CRM real, a de IA possui info do agente seguro e que os estilos de `hover` e "slide in" animam graciosamente a troca de conteúdo.
