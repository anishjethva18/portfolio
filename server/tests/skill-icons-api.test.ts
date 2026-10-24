import assert from 'node:assert/strict';
import express from 'express';
import { profileRouter } from '../routes/profile';
import { SIMPLE_ICON_CATALOG } from '../services/skillCatalog';

async function runSkillIconApiTests() {
  const app = express();
  app.use('/api/profile', profileRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}/api/profile`;
    const catalogResponse = await fetch(`${baseUrl}/skill-icons?catalog=it-v2`, { cache: 'no-store' });
    const catalogData = await catalogResponse.json() as {
      success: boolean;
      icons: Array<{ slug: string; title: string }>;
    };

    assert.equal(catalogResponse.status, 200);
    assert.equal(catalogResponse.headers.get('cache-control'), 'no-store');
    assert.equal(catalogData.success, true);
    assert(catalogData.icons.length > 100 && catalogData.icons.length < 200);
    assert.equal(catalogData.icons.length, SIMPLE_ICON_CATALOG.length);
    assert.equal(new Set(catalogData.icons.map((icon) => icon.slug)).size, catalogData.icons.length);
    assert.deepEqual(
      catalogData.icons.map((icon) => icon.title),
      [...catalogData.icons.map((icon) => icon.title)].sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' })
      )
    );
    assert(catalogData.icons.some((icon) => icon.slug === 'c'));
    assert(catalogData.icons.some((icon) => icon.slug === 'anaconda'));
    assert(catalogData.icons.some((icon) => icon.slug === 'openjdk'));
    assert(catalogData.icons.some((icon) => icon.slug === 'python'));
    assert(catalogData.icons.some((icon) => icon.slug === 'googlegemini'));

    let renderedIcons = 0;
    const failures: string[] = [];
    const batchSize = 100;
    for (let offset = 0; offset < catalogData.icons.length; offset += batchSize) {
      const batch = catalogData.icons.slice(offset, offset + batchSize);
      const results = await Promise.all(batch.map(async ({ slug, title }) => {
        const response = await fetch(`${baseUrl}/skill-icons/${encodeURIComponent(slug)}.svg`);
        const svg = await response.text();
        return {
          title,
          valid: response.ok &&
            response.headers.get('content-type')?.includes('image/svg+xml') === true &&
            svg.includes('<svg') &&
            svg.includes('<path'),
        };
      }));
      results.forEach(({ title, valid }) => {
        if (valid) renderedIcons += 1;
        else failures.push(title);
      });
    }

    const invalidIconResponse = await fetch(`${baseUrl}/skill-icons/not-a-real-brand.svg`);
    assert.equal(invalidIconResponse.status, 404);
    assert.deepEqual(failures, []);
    assert.equal(renderedIcons, catalogData.icons.length);
    console.log(`Verified ${renderedIcons} bundled brand icon SVGs; 0 failed.`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

void runSkillIconApiTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
