// CSV parser minimalista, header-only parsing. Aceita:
// - bitwarden: nome,url,username,password,notes,...
// - chrome:    name,url,username,password,note
// - firefox:   url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
// - generic:   name/username/user; url/site; password; notes/note
//
// Produz um `ParseResult` com warnings (linhas ignoradas por formato invalido)
// e itens normalizados para vault_items.

export type CsvFormat = 'csv-generic' | 'bitwarden' | 'chrome' | 'firefox';

export type ParsedRow = {
  externalId: string;
  type: 'login';
  name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
};

export type ParseResult = {
  format: CsvFormat;
  rows: ParsedRow[];
  warnings: Array<{ line: number; reason: string }>;
};

const MIN_HEADER = 3;

function splitLine(line: string): string[] {
  // Quote-aware split. Use RFC4180 simplified.
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\')) {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCsv(text: string, format: CsvFormat): ParseResult {
  if (text.length === 0) {
    return { format, rows: [], warnings: [{ line: 0, reason: 'empty input' }] };
  }
  // Limit input to a sane size to prevent OOM via accidental huge file.
  if (text.length > 10 * 1024 * 1024) {
    throw new Error('csv file exceeds 10MB cap');
  }
  // Normalize line endings.
  const raw = text.replace(/\r\n?/g, '\n');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  if (lines.length < 2) {
    return { format, rows: [], warnings: [{ line: 0, reason: 'header-only or empty' }] };
  }
  const headers = splitLine(lines[0] ?? '').map((h) => h.toLowerCase());
  const idx = pickIndices(headers, format);
  if (Object.keys(idx).length < MIN_HEADER) {
    throw new Error('csv header does not match expected format');
  }
  const rows: ParsedRow[] = [];
  const warnings: ParseResult['warnings'] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i] ?? '');
    const get = (k: keyof typeof idx): string => {
      const ix = idx[k];
      return ix === -1 ? '' : (cells[ix] ?? '');
    };
    const url = get('url');
    const username = get('username');
    const password = get('password');
    if (!password) {
      warnings.push({ line: i + 1, reason: 'missing password' });
      continue;
    }
    rows.push({
      externalId: get('id') || `csv-${i}`,
      type: 'login',
      name: get('name') || url || username,
      url,
      username,
      password,
      notes: get('notes'),
    });
  }
  return { format, rows, warnings };
}

function pickIndices(headers: string[], format: CsvFormat): { id: number; name: number; url: number; username: number; password: number; notes: number } {
  const find = (...alts: string[]) => alts.map((a) => headers.indexOf(a)).find((ix) => ix >= 0) ?? -1;
  switch (format) {
    case 'bitwarden': return { id: find('id'),         name: find('name'),         url: find('url'),         username: find('username'),         password: find('password'),         notes: find('notes', 'note') };
    case 'chrome':    return { id: find('guid','id'),  name: find('name'),         url: find('url','origin_url'), username: find('username'),     password: find('password'),         notes: find('note') };
    case 'firefox':   return { id: find('guid'),        name: find('url'),          url: find('url','formActionOrigin'), username: find('username'), password: find('password'),    notes: -1 };
    case 'csv-generic':
    default:
      return { id: find('id','guid','external_id'), name: find('name','title','label'), url: find('url','site','origin'), username: find('username','user','login','email'), password: find('password','pass','secret'), notes: find('notes','note','comment') };
  }
}

export const CSV_VERSION = '0.1.0';
