// The single source of truth for the site's tools. The landing page, the
// menu bar and the start menu all render from this list.

export type ToolStatus = 'available' | 'soon' | 'external';

export interface Tool {
  /** URL segment, in Portuguese: the tool lives at `/<slug>`. */
  slug: string;
  title: string;
  description: string;
  /** Icon name, resolved by the icon set added in M1.4. */
  icon: string;
  status: ToolStatus;
  /** Required when status is 'external'. */
  externalUrl?: string;
}

export const tools: readonly Tool[] = [
  {
    slug: 'indicativos',
    title: 'Indicativos',
    description: 'Veja quais indicativos de chamada estão livres em cada região.',
    icon: 'indicativos',
    status: 'available',
  },
  {
    slug: 'repetidoras',
    title: 'Repetidoras',
    description: 'Mapa de repetidoras de 2 m e 70 cm, com exportação para o CHIRP.',
    icon: 'repetidoras',
    status: 'available',
  },
  {
    slug: 'aprs',
    title: 'Símbolos APRS',
    description: 'Encontre símbolos APRS pela descrição ou pelo código e veja como digitá-los.',
    icon: 'aprs',
    status: 'available',
  },
];

export function toolHref(tool: Tool): string | undefined {
  switch (tool.status) {
    case 'available':
      return `/${tool.slug}`;
    case 'external':
      return tool.externalUrl;
    case 'soon':
      return undefined;
  }
}
