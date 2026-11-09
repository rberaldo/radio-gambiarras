// Minimal delimited-text parser: quoted fields with "" escapes, CRLF or LF.
// A quote inside an unquoted field is kept as a literal character, which is
// what Anatel's files need (they have stray quotes in free-text fields).

export function parseDelimited(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let quoted = false;
  let fieldStart = true;

  const endField = () => {
    row.push(field);
    field = '';
    fieldStart = true;
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  for (; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && fieldStart) {
      quoted = true;
      fieldStart = false;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      if (text[i + 1] !== '\n') endRow();
    } else {
      field += ch;
      fieldStart = false;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** dd/mm/yyyy to yyyy-mm-dd, or undefined for N/I and other non-dates. */
export function brDateToIso(value: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}
