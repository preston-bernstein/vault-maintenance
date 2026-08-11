import { describe, it, expect } from 'vitest';
import {
  matchesExclude,
  readFileContentSafe,
  toRelativePath,
  lastPathSegment,
  isMarkdownFile,
  stripMdExtension,
  walkDir,
} from '../src/utils/fs-helpers.js';
import { join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('matchesExclude', () => {
  it('matches exact path', () => {
    expect(
      matchesExclude('.obsidian/config.json', ['.obsidian/config.json']),
    ).toBe(true);
  });

  it('matches glob ** pattern', () => {
    expect(matchesExclude('.obsidian/plugins/foo.js', ['.obsidian/**'])).toBe(
      true,
    );
  });

  it('matches glob * segment', () => {
    expect(matchesExclude('foo/bar.md', ['foo/*'])).toBe(true);
  });

  it('returns false when no pattern matches', () => {
    expect(matchesExclude('Notes/Page.md', ['.obsidian/**'])).toBe(false);
  });

  it('matches pattern without slash or star (filename only)', () => {
    expect(matchesExclude('.DS_Store', ['.DS_Store'])).toBe(true);
    expect(matchesExclude('sub/.DS_Store', ['.DS_Store'])).toBe(true);
  });
});

describe('readFileContentSafe', () => {
  it('returns null when file does not exist', async () => {
    const result = await readFileContentSafe(
      join(tmpdir(), 'nonexistent-file-xyz.txt'),
    );
    expect(result).toBeNull();
  });
});

describe('toRelativePath', () => {
  it('returns path relative to root', () => {
    expect(toRelativePath('/vault/Notes/Page.md', '/vault')).toBe(
      'Notes/Page.md',
    );
  });
});

describe('lastPathSegment', () => {
  it('returns last segment', () => {
    expect(lastPathSegment('Folder/Page One')).toBe('Page One');
  });

  it('returns empty string for non-string input', () => {
    expect(lastPathSegment(undefined as unknown as string)).toBe('');
  });
});

describe('isMarkdownFile', () => {
  it('returns true for .md path', () => {
    expect(isMarkdownFile('x.md')).toBe(true);
  });
  it('returns false for non-.md', () => {
    expect(isMarkdownFile('x.txt')).toBe(false);
  });
});

describe('stripMdExtension', () => {
  it('strips .md suffix', () => {
    expect(stripMdExtension('Notes/Page.md')).toBe('Notes/Page');
  });
});

describe('walkDir', () => {
  it('returns all files recursively', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'walk-'));
    await writeFile(join(tmp, 'a.txt'), '');
    await writeFile(join(tmp, 'b.txt'), '');
    try {
      const files = await walkDir(tmp);
      expect(files.length).toBe(2);
      expect(files.some((f) => f.endsWith('a.txt'))).toBe(true);
      expect(files.some((f) => f.endsWith('b.txt'))).toBe(true);
    } finally {
      await rm(tmp, { recursive: true });
    }
  });
});
