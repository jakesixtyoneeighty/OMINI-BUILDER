import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ImportZip');

interface ImportedFile {
  path: string;
  content: string;
}

interface ImportResult {
  files: ImportedFile[];
  stats: { totalBlobs: number; imported: number; skipped: number; truncated: boolean };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
    }

    if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Please upload a ZIP file.' }), { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const { unzip } = await import('unzipit');
    const { entries } = await unzip(arrayBuffer);

    const files: ImportedFile[] = [];
    let skipped = 0;

    for (const [path, entry] of Object.entries(entries)) {
      if (path.endsWith('/')) continue;
      
      if (entry.size > 200 * 1024) { // Skip files larger than 200KB
        skipped++;
        continue;
      }
      const content = await entry.text();
      files.push({ path, content });
    }

    const result: ImportResult = {
      files,
      stats: {
        totalBlobs: files.length + skipped,
        imported: files.length,
        skipped,
        truncated: false,
      },
    };

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    logger.error('Error processing ZIP file', error);
    return new Response(JSON.stringify({ error: 'Failed to process ZIP file' }), { status: 500 });
  }
}