import assert from 'node:assert/strict';
import test from 'node:test';
import { isPortfolioDataMutation } from './portfolioSync';

test('social preview file uploads do not broadcast a content mutation', () => {
  assert.equal(isPortfolioDataMutation('/api/admin/social-preview/upload', 'POST'), false);
});

test('saving or publishing content still broadcasts a portfolio mutation', () => {
  assert.equal(isPortfolioDataMutation('/api/admin/content-studio/draft', 'PUT'), true);
  assert.equal(isPortfolioDataMutation('/api/admin/content-studio/publish', 'POST'), true);
});
