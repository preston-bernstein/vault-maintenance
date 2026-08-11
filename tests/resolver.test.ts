import { describe, it, expect } from 'vitest';
import { scanTestVault } from './helpers.js';
import {
  resolveLinks,
  getBrokenLinks,
  getAmbiguousLinks,
  getBrokenAndAmbiguousLinks,
} from '../src/resolver.js';

describe('resolveLinks', () => {
  it('resolves simple wiki-links by filename', async () => {
    const scan = await scanTestVault();
    const resolutions = resolveLinks(scan);

    // [[Page Two]] from FolderA/Page One.md should resolve
    const pageTwoRes = resolutions.find(
      (r) =>
        r.link.target === 'Page Two' &&
        r.link.sourceFile === 'FolderA/Page One.md',
    );
    expect(pageTwoRes).toBeDefined();
    expect(pageTwoRes!.status).toBe('resolved');
    expect(pageTwoRes!.resolvedTo!.relativePath).toBe('FolderB/Page Two.md');
  });

  it('resolves pathed wiki-links exactly', async () => {
    const scan = await scanTestVault();
    const resolutions = resolveLinks(scan);

    // [[FolderA/Page One]] from Root Note.md should resolve
    const pathed = resolutions.find(
      (r) =>
        r.link.target === 'FolderA/Page One' &&
        r.link.sourceFile === 'Root Note.md',
    );
    expect(pathed).toBeDefined();
    expect(pathed!.status).toBe('resolved');
    expect(pathed!.resolvedTo!.relativePath).toBe('FolderA/Page One.md');
  });

  it('detects broken links', async () => {
    const scan = await scanTestVault();
    const resolutions = resolveLinks(scan);
    const broken = getBrokenLinks(resolutions);

    // [[Nonexistent Page]] from Root Note.md should be broken
    const nonexistent = broken.find(
      (r) => r.link.target === 'Nonexistent Page',
    );
    expect(nonexistent).toBeDefined();
    expect(nonexistent!.status).toBe('broken');

    // [[Gone Page]] from FolderC/Index.md should also be broken
    const gonePage = broken.find((r) => r.link.target === 'Gone Page');
    expect(gonePage).toBeDefined();
  });

  it('detects ambiguous links', async () => {
    const scan = await scanTestVault();
    const resolutions = resolveLinks(scan);
    const ambiguous = getAmbiguousLinks(resolutions);

    // [[Overview]] from Root Note.md should be ambiguous (FolderA + FolderB)
    const overview = ambiguous.find((r) => r.link.target === 'Overview');
    expect(overview).toBeDefined();
    expect(overview!.candidates.length).toBe(2);
  });

  it('resolves embedded link with extension via filename index', async () => {
    const scan = await scanTestVault();
    const resolutions = resolveLinks(scan);

    const assetRes = resolutions.find(
      (r) =>
        r.link.target === 'asset.png' &&
        r.link.sourceFile === 'FolderC/Index.md',
    );
    expect(assetRes).toBeDefined();
    expect(assetRes!.status).toBe('resolved');
    expect(assetRes!.resolvedTo!.relativePath).toBe('FolderC/asset.png');
  });
});

describe('getBrokenAndAmbiguousLinks', () => {
  it('splits resolutions into broken and ambiguous in one pass', async () => {
    const scan = await scanTestVault();
    const resolutions = resolveLinks(scan);
    const { brokenLinks, ambiguousLinks } =
      getBrokenAndAmbiguousLinks(resolutions);

    expect(brokenLinks.every((r) => r.status === 'broken')).toBe(true);
    expect(ambiguousLinks.every((r) => r.status === 'ambiguous')).toBe(true);
    expect(brokenLinks.length + ambiguousLinks.length).toBeLessThanOrEqual(
      resolutions.length,
    );
  });
});
