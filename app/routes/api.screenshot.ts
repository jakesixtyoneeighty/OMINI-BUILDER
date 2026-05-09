import { json } from '@remix-run/cloudflare';

interface Env {
  SCREENSHOT_API_KEY?: string;
}

export async function loader({ request, context }: { request: Request; context: { env: Env } }) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Validate URL
    new URL(targetUrl);
  } catch {
    return json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    // Use Google PageSpeed Insights API for screenshot (free, no key required for basic usage)
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&strategy=mobile&category=performance`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Omni-Builder/1.0',
      },
    });

    if (!response.ok) {
      return json({ error: `Screenshot API returned ${response.status}` }, { status: 502 });
    }

    const data = await response.json() as any;
    const screenshotData = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;

    if (screenshotData) {
      return json({
        url: targetUrl,
        screenshot: screenshotData,
        title: data?.lighthouseResult?.audits?.['document-title']?.details?.items?.[0]?.title || targetUrl,
      });
    }

    return json({ error: 'No screenshot available', url: targetUrl }, { status: 404 });
  } catch (error) {
    console.error('[screenshot] Error:', error);
    return json({ error: 'Failed to capture screenshot' }, { status: 500 });
  }
}
