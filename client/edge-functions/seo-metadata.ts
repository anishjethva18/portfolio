import { renderSeoMetadataHtml, stripSeoMetadataHtml, type SeoContent } from '../src/utils/seoMetadata.ts';

type EdgeContext = {
  next: () => Promise<Response>;
};

type SeoApiResponse = {
  success?: boolean;
  published?: boolean;
  content?: SeoContent;
};

export async function renderHomepageMetadata(request: Request, context: EdgeContext): Promise<Response> {
  const response = await context.next();
  if (new URL(request.url).pathname !== '/' || !response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  try {
    const metadataResponse = await fetch(new URL('/api/seo-metadata', request.url), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!metadataResponse.ok) {
      throw new Error(`Published metadata endpoint returned HTTP ${metadataResponse.status}.`);
    }
    const payload = await metadataResponse.json() as SeoApiResponse;
    if (!payload.success || !payload.content || typeof payload.content !== 'object') {
      throw new Error('Published metadata endpoint returned an invalid response.');
    }
    if (typeof payload.published !== 'boolean') {
      throw new Error('Published metadata endpoint did not identify its publication state.');
    }

    const htmlWithMetadata = payload.published
      ? renderSeoMetadataHtml(html, payload.content, request.url)
      : stripSeoMetadataHtml(html);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return new Response(htmlWithMetadata, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('[SEO] Published homepage metadata could not be loaded.', error);
    return new Response('Published SEO metadata is temporarily unavailable.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

export default renderHomepageMetadata;
