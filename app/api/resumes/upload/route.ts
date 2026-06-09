import { NextResponse } from 'next/server';
import { route } from '@/lib/api-helpers';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'tex']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-tex',
  'text/x-tex',
  'text/plain', // browsers sometimes report .tex as text/plain
  'application/octet-stream', // fallback for some OS/browser combos
]);

export const POST = route(async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a .pdf, .docx, or .tex file.' },
      { status: 415 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'File content type does not match the expected format.' },
      { status: 415 }
    );
  }

  if (ext === 'tex') {
    const text = await file.text();
    return NextResponse.json({ text });
  }

  if (ext === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    return NextResponse.json({ text: result.text });
  }

  // ext === 'docx' (already validated above)
  const mammoth = await import('mammoth');
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.extractRawText({ buffer });
  return NextResponse.json({ text: result.value });
});
