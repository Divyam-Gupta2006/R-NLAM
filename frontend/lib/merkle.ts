/**
 * In-browser verification of an RFC 6962 inclusion proof (WebCrypto), so an
 * officer or auditor need not trust the server's own "verified: true".
 * Mirrors backend/src/audit/merkle.ts.
 */
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const bytes = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function sha(...parts: Uint8Array[]): Promise<Uint8Array> {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const buf = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

export async function verifyInclusionInBrowser(entryHash: string, index: number, treeSize: number, path: string[], root: string): Promise<boolean> {
  if (index >= treeSize) return false;
  let fn = index;
  let sn = treeSize - 1;
  let r = await sha(new Uint8Array([0]), bytes(entryHash));
  for (const p of path) {
    const sib = bytes(p);
    if (sn === 0) return false;
    if (fn % 2 === 1 || fn === sn) {
      r = await sha(new Uint8Array([1]), sib, r);
      if (fn % 2 === 0) {
        while (fn % 2 === 0 && fn !== 0) {
          fn >>= 1;
          sn >>= 1;
        }
      }
    } else {
      r = await sha(new Uint8Array([1]), r, sib);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 && hex(r.buffer as ArrayBuffer) === root;
}
