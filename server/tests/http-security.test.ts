import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  buildCorsPolicy,
  buildContentSecurityPolicyDirectives,
  parseTrustedProxyHops,
} from '../config/httpSecurity';
import { ContentProxyService, isPublicIpAddress, resolvePublicTarget } from '../services/contentProxy';

test('production CORS only allows explicitly configured origins', () => {
  const env = {
    NODE_ENV: 'production',
    APP_URL: 'https://portfolio.example',
    CORS_ALLOWED_ORIGINS: 'https://www.example, https://admin.example',
  } as NodeJS.ProcessEnv;
  const policy = buildCorsPolicy(env);

  assert.equal(policy.isAllowedOrigin('https://portfolio.example'), true);
  assert.equal(policy.isAllowedOrigin('https://www.example'), true);
  assert.equal(policy.isAllowedOrigin('https://admin.example'), true);
  assert.equal(policy.isAllowedOrigin('https://attacker.run.app'), false);
  assert.equal(policy.isAllowedOrigin('https://attacker.example'), false);
  assert.equal(policy.isAllowedOrigin(undefined), true);
});

test('Helmet emits the production CSP and CORS middleware denies unlisted origins', async () => {
  const policy = buildCorsPolicy({
    NODE_ENV: 'production',
    APP_URL: 'https://portfolio.example',
    CORS_ALLOWED_ORIGINS: 'https://www.example',
  } as NodeJS.ProcessEnv);
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(true),
    },
  }));
  app.use(cors({
    origin(origin, callback) {
      callback(null, policy.isAllowedOrigin(origin));
    },
  }));
  app.get('/headers', (_req, res) => res.sendStatus(204));
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start HTTP security header test server.');
  }

  try {
    const allowed = await fetch(`http://127.0.0.1:${address.port}/headers`, {
      headers: { Origin: 'https://www.example' },
    });
    const csp = allowed.headers.get('content-security-policy') || '';
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://www.example');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /script-src[^;]*(unsafe-inline|unsafe-eval)/);

    const denied = await fetch(`http://127.0.0.1:${address.port}/headers`, {
      headers: { Origin: 'https://attacker.run.app' },
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('development CORS keeps local development flexible', () => {
  const policy = buildCorsPolicy({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);

  assert.equal(policy.isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(policy.isAllowedOrigin('https://preview.example'), true);
});

test('trusted proxy hop configuration accepts only integers from zero through five', () => {
  assert.equal(parseTrustedProxyHops(undefined), 0);
  assert.equal(parseTrustedProxyHops(' 3 '), 3);
  for (const invalidValue of ['-1', '6', '2.5', '2proxy', 'NaN']) {
    assert.throws(() => parseTrustedProxyHops(invalidValue), /TRUST_PROXY_HOPS/);
  }
});

test('production CSP restricts executable and embeddable content', () => {
  const directives = buildContentSecurityPolicyDirectives(true);

  assert.deepEqual(directives.defaultSrc, ["'self'"]);
  assert.deepEqual(directives.scriptSrc, ["'self'"]);
  assert.deepEqual(directives.objectSrc, ["'none'"]);
  assert.deepEqual(directives.frameAncestors, ["'self'"]);
  assert.deepEqual(directives.upgradeInsecureRequests, []);
  assert.equal(directives.scriptSrc?.includes("'unsafe-inline'"), false);
  assert.equal(directives.scriptSrc?.includes("'unsafe-eval'"), false);
  assert.deepEqual(directives.connectSrc, [
    "'self'",
    'https://api.open-meteo.com',
    'https://geocoding-api.open-meteo.com',
    'https://wttr.in',
  ]);
});

test('development CSP allows local Vite HMR without weakening production', () => {
  const directives = buildContentSecurityPolicyDirectives(false);

  assert.ok(directives.connectSrc?.includes("'self'"));
  assert.ok(directives.connectSrc?.includes('ws:'));
  assert.equal(directives.connectSrc?.includes('https:'), true);
  assert.equal(directives.upgradeInsecureRequests, undefined);
});

test('proxy address policy rejects non-public IPv4 and IPv6 ranges', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.20.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
  ]) {
    assert.equal(isPublicIpAddress(address), false, `${address} must be blocked`);
  }

  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2001:4860:4860::8888'), true);
});

test('proxy DNS validation rejects private answers and nonstandard ports', async () => {
  await assert.rejects(
    resolvePublicTarget(
      new URL('https://mixed.example'),
      async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.2', family: 4 },
      ],
    ),
    /private, link-local/,
  );
  await assert.rejects(
    resolvePublicTarget(new URL('http://public.example:8080'), async () => [
      { address: '8.8.8.8', family: 4 },
    ]),
    /standard HTTP and HTTPS ports/,
  );
});

test('proxy validates every redirect before making its next request', async () => {
  let requestCount = 0;
  const proxy = new ContentProxyService(
    async (hostname) => [{
      address: hostname === '127.0.0.1' ? '127.0.0.1' : '8.8.8.8',
      family: 4,
    }],
    async () => {
      requestCount += 1;
      return {
        statusCode: 302,
        headers: { location: 'http://127.0.0.1/admin' },
        body: Buffer.alloc(0),
      };
    },
  );

  const result = await proxy.fetchAndSanitize('https://redirect-test.example/');

  assert.equal(result.success, false);
  assert.match(result.error || '', /private, link-local/);
  assert.equal(requestCount, 1);
});

test('proxy returns bounded HTML and rejects oversized responses and URLs', async () => {
  const resolveAddresses = async () => [{ address: '8.8.8.8', family: 4 }];
  const request = async () => ({
    statusCode: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: Buffer.from('<html><head><title>Safe page</title></head><body>content</body></html>'),
  });
  const proxy = new ContentProxyService(resolveAddresses, request);
  const result = await proxy.fetchAndSanitize('https://proxy-test-unique.example/');

  assert.equal(result.success, true);
  assert.match(result.html || '', /<title>Safe page<\/title>/);
  assert.match(result.html || '', /BROWSER_NAVIGATE/);

  const oversizedProxy = new ContentProxyService(resolveAddresses, async () => ({
    statusCode: 200,
    headers: { 'content-type': 'text/html' },
    body: Buffer.alloc(5 * 1024 * 1024 + 1),
  }));
  const oversized = await oversizedProxy.fetchAndSanitize('https://oversized-test-unique.example/');
  assert.equal(oversized.success, false);
  assert.match(oversized.error || '', /5 MB response limit/);

  const tooLong = await proxy.fetchAndSanitize(`https://example.com/${'a'.repeat(2048)}`);
  assert.equal(tooLong.success, false);
  assert.match(tooLong.error || '', /2048-character limit/);
});
