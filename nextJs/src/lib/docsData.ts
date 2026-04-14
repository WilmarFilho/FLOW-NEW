export interface DocSection {
  title: string;
  items: DocItem[];
}

export interface DocItem {
  title: string;
  slug: string;
  content?: string;
}

export const DOCS_DATA: DocSection[] = [
  {
    title: 'Começando',
    items: [
      { title: 'Introdução ao FLOW', slug: 'introducao' },
      { title: 'Primeiros Passos', slug: 'primeiros-passos' },
    ],
  },
  {
    title: 'Recursos',
    items: [
      { title: 'Gestão de Contatos', slug: 'gestao-contatos' },
      { title: 'Conexões e WhatsApp', slug: 'conexoes-whatsapp' },
      { title: 'Agendamentos e IA', slug: 'agendamentos' },
      { title: 'Disparo de Campanhas', slug: 'campanhas' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { title: 'Gerenciando Atendentes', slug: 'atendentes' },
      { title: 'Treinando a IA (Bases)', slug: 'bases-conhecimento' },
    ],
  },
];

// Função helper para pegar os dados do mardown via hardcode por hora
export function getDocBySlug(slug: string): { title: string; content: string } | null {
  for (const section of DOCS_DATA) {
    for (const item of section.items) {
      if (item.slug === slug) {
        return {
          title: item.title,
          content: generateMockContent(item.title)
        };
      }
    }
  }
  return null;
}

function generateMockContent(title: string) {
  return `
# ${title}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique.

## Principais Funcionalidades

- **Automação** de atendimento 24/7.
- **Roteamento** inteligente para humanos quando necessário.
- **Integração** oficial de WhatsApp e Kanban CRM.

### Como funciona

Duis cursus, mi quis viverra ornare, eros dolor interdum nulla, ut commodo diam libero vitae erat. Aenean faucibus nibh et justo cursus id rutrum lorem imperdiet. Nunc ut sem vitae risus tristique posuere.

> Esta é uma nota importante sobre o funcionamento da ferramenta que exige que o usuário preste muita atenção.

Para mais detalhes técnicos, consulte as guias adicionais no menu ao lado. Você pode estruturar mais conteúdo utilizando Markdown no futuro.
  `;
}
