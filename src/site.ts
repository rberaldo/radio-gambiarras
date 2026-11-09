// The site name lives here and nowhere else.
export const site = {
  name: 'Rádio Gambiarras',
  description: 'Ferramentas para o radioamador',
  lang: 'pt-BR',
  repo: 'https://github.com/rberaldo/radio-gambiarras',
  author: { name: 'Rafael Beraldo', callsign: 'PU1JAZ' },
} as const;

export interface MetaPage {
  href: string;
  title: string;
}

// Site pages shown in every window's menu bar next to the tools.
export const metaPages: readonly MetaPage[] = [
  { href: '/', title: 'Início' },
  { href: '/sobre', title: 'Sobre' },
];
