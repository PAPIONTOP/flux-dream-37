/**
 * Dean Edwards p.a.c.k.e.r unpacker. Pure JS, no eval.
 * Returns the unpacked source string, or null if input doesn't match.
 */
// Matches: }('PAYLOAD',BASE,COUNT,'SYMTAB'.split('|') — supports \' escapes.
const PACKED_RE =
  /\}\s*\(\s*'((?:\\.|[^'\\])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\.|[^'\\])*)'\s*\.split\('\|'\)/;

function baseN(n: number, base: number): string {
  if (n < base) {
    const c = n < 10 ? String(n) : String.fromCharCode(n + 87); // a..z
    return c;
  }
  return baseN(Math.floor(n / base), base) + baseN(n % base, base);
}

export function unpack(source: string): string | null {
  const m = PACKED_RE.exec(source);
  if (!m) return null;
  const payload = m[1];
  const base = parseInt(m[2], 10);
  const count = parseInt(m[3], 10);
  const symtab = m[4].split("|");
  if (symtab.length !== count) {
    // not fatal, but unusual
  }
  // Replace tokens \w+ that match baseN words
  const unpacked = payload.replace(/\b\w+\b/g, (word) => {
    let idx: number;
    try {
      idx = parseInt(word, base);
    } catch {
      return word;
    }
    if (Number.isNaN(idx)) return word;
    const sym = symtab[idx];
    return sym && sym.length ? sym : word;
  });
  // Unescape common sequences
  return unpacked.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
