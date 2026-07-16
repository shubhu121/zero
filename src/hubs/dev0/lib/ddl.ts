export interface Column { name: string; type: string; pk: boolean; nullable: boolean; }
export interface Table { name: string; columns: Column[]; }
export interface FK { fromTable: string; fromColumn: string; toTable: string; toColumn: string; }
export interface Schema { tables: Table[]; fks: FK[]; }

const unq = (s: string) => s.trim().replace(/^[`"\[]|[`"\]]$/g, '');

function splitTop(body: string): string[] {
  const parts: string[] = []; let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const CONSTRAINT_START = /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|KEY|INDEX|CHECK)\b/i;

export function parseDDL(sql: string): Schema {
  const tables: Table[] = []; const fks: FK[] = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"\[]?[\w $]+[`"\]]?)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const tableName = unq(m[1]!.trim());
    let depth = 1, i = re.lastIndex;
    while (i < sql.length && depth > 0) {
      if (sql[i] === '(') depth++;
      if (sql[i] === ')') depth--;
      i++;
    }
    const body = sql.slice(re.lastIndex, i - 1);
    re.lastIndex = i;
    const cols: Column[] = [];
    for (const part of splitTop(body)) {
      const fkm = part.match(/FOREIGN\s+KEY\s*\(\s*([`"\[]?\w+[`"\]]?)\s*\)\s*REFERENCES\s+([`"\[]?[\w $]+[`"\]]?)\s*\(\s*([`"\[]?\w+[`"\]]?)\s*\)/i);
      if (fkm) {
        fks.push({ fromTable: tableName, fromColumn: unq(fkm[1]!), toTable: unq(fkm[2]!), toColumn: unq(fkm[3]!) });
        continue;
      }
      const pkm = part.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkm) {
        for (const c of pkm[1]!.split(',')) {
          const col = cols.find((x) => x.name === unq(c.trim()));
          if (col) col.pk = true;
        }
        continue;
      }
      if (CONSTRAINT_START.test(part)) continue;
      // Name is either a quoted/bracketed identifier (may contain spaces) or a
      // bare identifier (no spaces); then whitespace, then the type.
      const cm = part.match(/^(`[^`]+`|"[^"]+"|\[[^\]]+\]|[\w$]+)\s+(\w+(?:\s*\([\d\s,]+\))?)/);
      if (!cm) continue;
      const col: Column = {
        name: unq(cm[1]!), type: cm[2]!.replace(/\s+/g, ''),
        pk: /PRIMARY\s+KEY/i.test(part), nullable: !/NOT\s+NULL/i.test(part),
      };
      const refm = part.match(/REFERENCES\s+([`"\[]?[\w $]+[`"\]]?)\s*\(\s*([`"\[]?\w+[`"\]]?)\s*\)/i);
      if (refm) fks.push({ fromTable: tableName, fromColumn: col.name, toTable: unq(refm[1]!), toColumn: unq(refm[2]!) });
      cols.push(col);
    }
    tables.push({ name: tableName, columns: cols });
  }
  return { tables, fks };
}
