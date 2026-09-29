/**
 * Minimal single-page PDF (Helvetica, one text block), so seeded documents are
 * real downloadable files whose SHA-256 can be verified. Every page is stamped
 * SYNTHETIC.
 */
export function makePdf(title: string, lines: string[]): Buffer {
  const esc = (t: string) => t.replace(/[^\x20-\x7e]/g, '?').replace(/([()\\])/g, '\\$1');
  const body = [
    'BT /F1 16 Tf 60 780 Td (' + esc(title) + ') Tj ET',
    'BT /F1 10 Tf 60 760 Td (SYNTHETIC DEMONSTRATION DOCUMENT - NOT A REAL GOVERNMENT RECORD) Tj ET',
    ...lines.map((l, i) => `BT /F1 11 Tf 60 ${730 - i * 16} Td (${esc(l)}) Tj ET`),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
