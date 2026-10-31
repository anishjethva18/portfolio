import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import helmet from 'helmet';
import { setPortfolioMediaResourcePolicy } from '../utils/portfolioMediaHeaders';

async function getResourcePolicy(isPubliclyReferenced: boolean): Promise<string | null> {
  const app = express();
  app.use(helmet());
  app.get('/media', (_req, res) => {
    setPortfolioMediaResourcePolicy(res, isPubliclyReferenced);
    res.sendStatus(200);
  });
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not start portfolio media header test server.');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/media`);
    assert.equal(response.status, 200);
    return response.headers.get('cross-origin-resource-policy');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('publicly referenced portfolio and email branding media can be embedded cross-origin', async () => {
  assert.equal(await getResourcePolicy(true), 'cross-origin');
});

test('unpublished or private portfolio media remains restricted to same-origin requests', async () => {
  assert.equal(await getResourcePolicy(false), 'same-origin');
});
