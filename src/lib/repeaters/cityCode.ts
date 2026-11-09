// A short city tag (up to three letters) put before the callsign in the
// downloads, so a radio's channel list reads "RIO PY1XXX", "POA PY3XXX".
// Well-known cities use the tag people already say or see on airport signs;
// every other city gets initials or its first three letters.

/** Tags people recognize, by "Município/UF". */
const KNOWN: Record<string, string> = {
  // Capitals
  'Rio de Janeiro/RJ': 'RIO',
  'São Paulo/SP': 'SP',
  'Belo Horizonte/MG': 'BH',
  'Brasília/DF': 'BSB',
  'Porto Alegre/RS': 'POA',
  'Salvador/BA': 'SSA',
  'Recife/PE': 'REC',
  'Fortaleza/CE': 'FOR',
  'Curitiba/PR': 'CWB',
  'Manaus/AM': 'MAO',
  'Belém/PA': 'BEL',
  'Goiânia/GO': 'GYN',
  'Florianópolis/SC': 'FLN',
  'Vitória/ES': 'VIX',
  'Natal/RN': 'NAT',
  'João Pessoa/PB': 'JP',
  'Maceió/AL': 'MCZ',
  'Aracaju/SE': 'AJU',
  'Teresina/PI': 'THE',
  'São Luís/MA': 'SLZ',
  'Cuiabá/MT': 'CGB',
  'Campo Grande/MS': 'CG',
  'Porto Velho/RO': 'PVH',
  'Rio Branco/AC': 'RBR',
  'Macapá/AP': 'MCP',
  'Boa Vista/RR': 'BVB',
  'Palmas/TO': 'PMW',
  // Large or well-known cities
  'Campinas/SP': 'CPS',
  'Guarulhos/SP': 'GRU',
  'Santos/SP': 'STS',
  'São José dos Campos/SP': 'SJC',
  'São José do Rio Preto/SP': 'RPT',
  'Ribeirão Preto/SP': 'RP',
  'Presidente Prudente/SP': 'PP',
  'Santo André/SP': 'STA',
  'São Bernardo do Campo/SP': 'SBC',
  'São Caetano do Sul/SP': 'SCS',
  'Niterói/RJ': 'NIT',
  'São Gonçalo/RJ': 'SG',
  'Duque de Caxias/RJ': 'CAX',
  'Campos dos Goytacazes/RJ': 'CAM',
  'Paraty/RJ': 'PTY',
  'Itatiaia/RJ': 'ITT',
  'Juiz de Fora/MG': 'JF',
  'Uberlândia/MG': 'UDI',
  'Montes Claros/MG': 'MOC',
  'Londrina/PR': 'LDB',
  'Maringá/PR': 'MGA',
  'Foz do Iguaçu/PR': 'FOZ',
  'Ponta Grossa/PR': 'PG',
  'Joinville/SC': 'JOI',
  'Blumenau/SC': 'BNU',
  'Caxias do Sul/RS': 'CXS',
  'Feira de Santana/BA': 'FSA',
  'Vitória da Conquista/BA': 'VDC',
};

/** Words left out of initials: "Foz do Iguaçu" → FI, not FDI. */
const CONNECTORS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'DEL', 'E', 'D']);

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]+/g, ' ');

/** "RIO", "POA", "SJP" (São José dos Pinhais), "TER" (Teresópolis). */
export function cityCode(municipio: string, uf: string): string {
  const known = KNOWN[`${municipio}/${uf}`];
  if (known) return known;
  const words = plain(municipio)
    .split(/\s+/)
    .filter((w) => w && !CONNECTORS.has(w));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0]!.slice(0, 3);
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('');
}
