import { NextResponse } from 'next/server';
import { route } from '@/lib/api-helpers';

export const POST = route(async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

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

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return NextResponse.json({ text: result.value });
  }

  return NextResponse.json(
    { error: 'Unsupported file type. Upload a .pdf, .docx, or .tex file.' },
    { status: 415 }
  );
});
