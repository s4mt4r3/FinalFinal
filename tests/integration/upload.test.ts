import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import * as upload from '@/app/api/resumes/upload/route';
import { newUser, silenceConsoleError } from '../helpers/route';
import { createSupabaseMock } from '../helpers/supabase-mock';
import { signInAs, signOut } from '../helpers/mock-supabase-server';

vi.mock('@/lib/supabase-server', () => import('../helpers/mock-supabase-server'));

// Smallest valid single-page PDF with one line of text, xref offsets computed.
function tinyPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

async function tinyDocx(text: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

async function post(file?: { name: string; type: string; bytes: Uint8Array | string }) {
  const fd = new FormData();
  if (file) fd.set('file', new File([file.bytes as BlobPart], file.name, { type: file.type }));
  const req = new Request('http://localhost:3000/api/resumes/upload', { method: 'POST', body: fd });
  const res = await upload.POST(req, undefined);
  return { status: res.status, json: await res.json() };
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('POST /api/resumes/upload', () => {
  beforeEach(() => signInAs(newUser(), createSupabaseMock().client));

  it('requires authentication', async () => {
    signOut();
    expect((await post({ name: 'a.tex', type: 'text/plain', bytes: 'x' })).status).toBe(401);
  });

  it('returns 400 when no file is attached', async () => {
    expect(await post()).toEqual({ status: 400, json: { error: 'No file provided' } });
  });

  it('extracts .tex as plain text (no execution)', async () => {
    const tex = '\\input{/etc/passwd} \\section{Experience}';
    expect(await post({ name: 'Resume.TEX', type: 'application/x-tex', bytes: tex })).toEqual({ status: 200, json: { text: tex } });
  });

  // BUG: pdf-parse v2 has no default export; `(await import('pdf-parse')).default`
  // is undefined, so every PDF upload 500s ("pdfParse is not a function").
  it('extracts text from a PDF', async () => {
    silenceConsoleError();
    const res = await post({ name: 'resume.pdf', type: 'application/pdf', bytes: tinyPdf('Hello from PDF') });
    expect(res.status).toBe(200);
    expect(res.json.text).toContain('Hello from PDF');
  });

  it('extracts text from a DOCX', async () => {
    const res = await post({ name: 'resume.docx', type: DOCX, bytes: await tinyDocx('Hello from DOCX') });
    expect(res.status).toBe(200);
    expect(res.json.text).toContain('Hello from DOCX');
  });

  it.each([
    ['resume.exe', 'application/octet-stream'],
    ['resume', 'application/pdf'],
    ['resume.pdf.html', 'text/html'],
  ])('rejects disallowed extension %s with 415', async (name, type) => {
    expect((await post({ name, type, bytes: 'x' })).status).toBe(415);
  });

  it('rejects a mismatched content type with 415', async () => {
    expect((await post({ name: 'resume.pdf', type: 'text/html', bytes: '<script>' })).status).toBe(415);
  });

  it('rejects files over 10 MB with 413', async () => {
    const res = await post({ name: 'big.tex', type: 'text/plain', bytes: new Uint8Array(10 * 1024 * 1024 + 1) });
    expect(res).toEqual({ status: 413, json: { error: 'File too large (max 10 MB)' } });
  });

  it('fails without leaking parser internals on a corrupt PDF (production)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    silenceConsoleError();
    const res = await post({ name: 'bad.pdf', type: 'application/pdf', bytes: 'not a pdf at all' });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: 'Internal server error' });
  });
});
