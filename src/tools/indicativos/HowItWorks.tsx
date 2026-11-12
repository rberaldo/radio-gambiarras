// The "Como isto funciona?" note under the grid.

export function HowItWorks() {
  return (
    <details class="cs-about">
      <summary>Como isto funciona?</summary>
      <ul>
        <li>
          A lista de indicativos em uso vem dos dados abertos da Anatel e é atualizada uma vez por dia. Nomes e documentos
          dos titulares não são publicados aqui.
        </li>
        <li>
          Os indicativos possíveis seguem as regras do Ato Anatel nº 3.448/2026: prefixo do estado, classe e sufixos
          proibidos (como SOS e a série QAA–QZZ).
        </li>
        <li>
          Um indicativo cancelado fica reservado por um ano. Quando um indicativo some da base, ele fica marcado como
          “em quarentena”.
        </li>
        <li>
          “Livre” significa que não encontramos o indicativo na base. A decisão final é da Anatel, no pedido de
          licenciamento.
        </li>
      </ul>
    </details>
  );
}
