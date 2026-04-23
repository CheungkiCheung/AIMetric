import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface KnowledgeMatch {
  filePath: string;
  title: string;
  snippet: string;
  score: number;
}

const defaultDocsRoot = fileURLToPath(new URL('../../../../docs', import.meta.url));

export class KnowledgeSearchService {
  constructor(private readonly docsRoot = defaultDocsRoot) {}

  async search(input: { query: string; limit?: number }) {
    const files = await collectMarkdownFiles(this.docsRoot);
    const matches: KnowledgeMatch[] = [];
    const normalizedQuery = input.query.trim().toLowerCase();

    if (!normalizedQuery) {
      return {
        query: input.query,
        matches,
      };
    }

    await Promise.all(
      files.map(async (filePath) => {
        const content = await readFile(filePath, 'utf8');
        const normalizedContent = content.toLowerCase();
        const firstIndex = normalizedContent.indexOf(normalizedQuery);

        if (firstIndex < 0) {
          return;
        }

        matches.push({
          filePath: toRepoRelativePath(filePath),
          title: extractTitle(content),
          snippet: extractSnippet(content, firstIndex, input.query.length),
          score: countOccurrences(normalizedContent, normalizedQuery),
        });
      }),
    );

    matches.sort((left, right) => right.score - left.score);

    return {
      query: input.query,
      matches: matches.slice(0, input.limit ?? 5),
    };
  }
}

const collectMarkdownFiles = async (directoryPath: string): Promise<string[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFiles(entryPath);
      }

      return entry.name.endsWith('.md') ? [entryPath] : [];
    }),
  );

  return nestedFiles.flat();
};

const extractTitle = (content: string): string => {
  const heading = content
    .split('\n')
    .find((line) => line.trim().startsWith('# '));

  return heading ? heading.replace(/^#\s+/, '').trim() : 'Untitled';
};

const extractSnippet = (
  content: string,
  startIndex: number,
  queryLength: number,
): string => {
  const snippetStart = Math.max(0, startIndex - 40);
  const snippetEnd = Math.min(content.length, startIndex + queryLength + 80);

  return content.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();
};

const countOccurrences = (content: string, query: string): number => {
  let count = 0;
  let currentIndex = 0;

  while (currentIndex >= 0) {
    currentIndex = content.indexOf(query, currentIndex);

    if (currentIndex >= 0) {
      count += 1;
      currentIndex += query.length;
    }
  }

  return count;
};

const toRepoRelativePath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const docsIndex = normalized.indexOf('/docs/');

  return docsIndex >= 0 ? normalized.slice(docsIndex + 1) : normalized;
};
