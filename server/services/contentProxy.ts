import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';

export interface ProxyResult {
  success: boolean;
  html?: string;
  contentType?: string;
  title?: string;
  finalUrl?: string;
  error?: string;
}

interface ProxyAddress {
  address: string;
  family: number;
}

interface PinnedProxyResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

type ResolveAddresses = (hostname: string) => Promise<ProxyAddress[]>;
type RequestPinned = (url: URL, address: ProxyAddress) => Promise<PinnedProxyResponse>;

const proxyCache = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isDeniedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [first, second, third] = parts;
  return first === 0 ||
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224;
}

function parseIpv6Words(address: string): number[] | null {
  const normalized = address.toLowerCase().split('%')[0];
  if (!normalized || normalized.includes('.')) return null;
  const sections = normalized.split('::');
  if (sections.length > 2) return null;
  const left = sections[0] ? sections[0].split(':') : [];
  const right = sections.length === 2 && sections[1] ? sections[1].split(':') : [];
  const parseSection = (part: string): number | null =>
    /^[\da-f]{1,4}$/.test(part) ? Number.parseInt(part, 16) : null;
  const leftWords = left.map(parseSection);
  const rightWords = right.map(parseSection);
  if (leftWords.includes(null) || rightWords.includes(null)) return null;
  const missingWords = 8 - leftWords.length - rightWords.length;
  if ((sections.length === 1 && missingWords !== 0) || (sections.length === 2 && missingWords < 1)) {
    return null;
  }
  return [
    ...(leftWords as number[]),
    ...Array<number>(missingWords).fill(0),
    ...(rightWords as number[]),
  ];
}

export function isPublicIpAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !isDeniedIpv4(address);
  if (family !== 6) return false;

  const words = parseIpv6Words(address);
  if (!words) return false;
  const first = words[0];
  const second = words[1];
  const isGlobalUnicast = (first & 0xe000) === 0x2000;
  const isSpecialPurpose = first === 0x2001 && (second <= 0x01ff || second === 0x0db8);
  const is6to4 = first === 0x2002;
  const isDocumentation = first === 0x3fff && second <= 0x0fff;
  return isGlobalUnicast && !isSpecialPurpose && !is6to4 && !isDocumentation;
}

async function lookupAddresses(hostname: string): Promise<ProxyAddress[]> {
  if (net.isIP(hostname)) return [{ address: hostname, family: net.isIP(hostname) }];
  return dns.lookup(hostname, { all: true, verbatim: true });
}

export async function resolvePublicTarget(
  target: URL,
  resolveAddresses: ResolveAddresses = lookupAddresses,
): Promise<ProxyAddress> {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS addresses can be opened.');
  }
  if (target.username || target.password) {
    throw new Error('URLs containing credentials are not permitted.');
  }
  const expectedPort = target.protocol === 'https:' ? '443' : '80';
  if (target.port && target.port !== expectedPort) {
    throw new Error('Only standard HTTP and HTTPS ports are permitted.');
  }

  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Access to private, link-local, or cloud metadata network addresses is restricted.');
  }

  const addresses = await resolveAddresses(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('Access to private, link-local, or cloud metadata network addresses is restricted.');
  }
  return addresses[0];
}

function requestPinned(url: URL, address: ProxyAddress): Promise<PinnedProxyResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const request = transport.request({
      protocol: url.protocol,
      hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        Host: url.host,
        'User-Agent': 'WindowsPortfolioWebProxy/1.0',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
      lookup: (_host, options, callback) => {
        const resolved = { address: address.address, family: address.family as 4 | 6 };
        if (options && typeof options === 'object' && options.all) {
          callback(null, [resolved]);
        } else {
          callback(null, resolved.address, resolved.family);
        }
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('The target page exceeded the 5 MB response limit.'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode || 502,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      const error = new Error('Page request timed out after 12 seconds.');
      error.name = 'AbortError';
      request.destroy(error);
    });
    request.on('error', reject);
    request.end();
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function safeScriptJson(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function createBinaryPlaceholder(url: URL, contentType: string): string {
  const href = escapeHtml(url.href);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(url.hostname)}</title>
    <style>body{font-family:sans-serif;background:#0f172a;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.card{padding:24px;background:#1e293b;border-radius:16px;max-width:480px;text-align:center}</style></head>
    <body><div class="card"><h2>Direct Media/Binary Content</h2>
    <p>This URL points to ${escapeHtml(contentType || 'binary content')} rather than standard HTML.</p>
    <a href="${href}" target="_blank" rel="noreferrer">Open in External Tab</a></div></body></html>`;
}

function injectBrowserNavigation(rawHtml: string, baseUrl: URL): string {
  const injectedHeader = `<base href="${escapeHtml(baseUrl.href)}">
    <script>
      (function() {
        function resolveUrl(href) {
          try { return new URL(href, window.location.href).href; }
          catch (_) { return ''; }
        }
        document.addEventListener('click', function(event) {
          var target = event.target;
          while (target && target.tagName !== 'A') target = target.parentNode;
          if (!target || !target.getAttribute('href')) return;
          var href = target.getAttribute('href');
          if (href.startsWith('#') || href.startsWith('javascript:')) return;
          event.preventDefault();
          var url = resolveUrl(href);
          if (/^https?:\\/\\//i.test(url)) {
            window.parent.postMessage({ type: 'BROWSER_NAVIGATE', url: url }, '*');
          }
        }, true);
        document.addEventListener('submit', function(event) {
          var form = event.target;
          if ((form.getAttribute('method') || 'get').toLowerCase() !== 'get') return;
          event.preventDefault();
          var action = resolveUrl(form.getAttribute('action') || window.location.href);
          if (!/^https?:\\/\\//i.test(action)) return;
          var params = new URLSearchParams(new FormData(form));
          var destination = new URL(action);
          params.forEach(function(value, key) { destination.searchParams.append(key, value); });
          window.parent.postMessage({ type: 'BROWSER_NAVIGATE', url: destination.href }, '*');
        }, true);
      })();
    </script>`;
  const headMatch = /<head\b[^>]*>/i;
  if (headMatch.test(rawHtml)) return rawHtml.replace(headMatch, (head) => `${head}${injectedHeader}`);
  const htmlMatch = /<html\b[^>]*>/i;
  if (htmlMatch.test(rawHtml)) return rawHtml.replace(htmlMatch, (html) => `${html}<head>${injectedHeader}</head>`);
  return `<head>${injectedHeader}</head>${rawHtml}`;
}

export class ContentProxyService {
  constructor(
    private readonly resolveAddresses: ResolveAddresses = lookupAddresses,
    private readonly request: RequestPinned = requestPinned,
  ) {}

  public async fetchAndSanitize(targetUrl: string): Promise<ProxyResult> {
    if (targetUrl.length > 2048) {
      return { success: false, error: 'The target URL exceeds the 2048-character limit.' };
    }
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`);
    } catch {
      return { success: false, error: 'Invalid URL format provided.' };
    }

    try {
      if (url.username || url.password || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        return { success: false, error: 'Only credential-free HTTP and HTTPS URLs are permitted.' };
      }
      const cacheKey = url.href;
      const cached = proxyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { success: true, html: cached.html, contentType: 'text/html', finalUrl: cacheKey };
      }

      let currentUrl = url;
      let response: PinnedProxyResponse | undefined;
      for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const address = await resolvePublicTarget(currentUrl, this.resolveAddresses);
        response = await this.request(currentUrl, address);
        const location = response.headers.location;
        if (!REDIRECT_STATUSES.has(response.statusCode) || typeof location !== 'string') break;
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error('The target website redirected too many times.');
        }
        currentUrl = new URL(location, currentUrl);
      }
      if (!response) throw new Error('The target website returned no response.');
      if (response.body.byteLength > MAX_RESPONSE_BYTES) {
        throw new Error('The target page exceeded the 5 MB response limit.');
      }

      const contentTypeHeader = response.headers['content-type'];
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] || '' : contentTypeHeader || '';
      const isHtml = /^(text\/html|application\/xhtml\+xml)\b/i.test(contentType);
      const html = isHtml
        ? injectBrowserNavigation(response.body.toString('utf8'), currentUrl)
        : createBinaryPlaceholder(currentUrl, contentType);
      proxyCache.set(cacheKey, { html, timestamp: Date.now() });
      while (proxyCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = proxyCache.keys().next().value;
        if (oldestKey === undefined) break;
        proxyCache.delete(oldestKey);
      }
      return {
        success: true,
        html,
        contentType: 'text/html; charset=utf-8',
        finalUrl: currentUrl.href,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load webpage.';
      if (error instanceof Error && error.name !== 'AbortError' && !message.includes('restricted')) {
        console.error('[ContentProxy] Fetch failed:', error);
      }
      return { success: false, error: message };
    }
  }
}

export const contentProxy = new ContentProxyService();
