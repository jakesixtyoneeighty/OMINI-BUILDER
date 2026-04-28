// ============================================================
// Omni-Builder — Code Parser (LLM output → FileArtifacts)
// ============================================================
import type { FileArtifact } from '@/types';

/**
 * Parse the LLM response and extract file artifacts.
 * Supports multiple formats:
 *
 * 1. Markdown code blocks with path comments:
 *    ```tsx
 *    // src/App.tsx
 *    <code>
 *    ```
 *
 * 2. Path-prefixed code blocks:
 *    ```tsx:title=src/App.tsx
 *    <code>
 *    ```
 *
 * 3. XML-style file blocks:
 *    <file path="src/App.tsx">
 *    <code>
 *    </file>
 */
export function parseCodeFromResponse(text: string): {
  message: string;
  artifacts: FileArtifact[];
} {
  const artifacts: FileArtifact[] = [];

  // Strategy 1: Match ```lang:path or ```lang:title=path blocks
  const codeBlockRegex = /```(\w+)(?::title=|:)([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const path = match[2].trim();
    const content = match[3].trim();
    artifacts.push({ path, content, action: 'create' });
    text = text.replace(match[0], '');
  }

  // Strategy 2: Match code blocks where first line is a comment with a file path
  const commentBlockRegex = /```(\w+)\n\/\/\s*(\S+)\n([\s\S]*?)```/g;
  while ((match = commentBlockRegex.exec(text)) !== null) {
    const path = match[2].trim();
    const content = match[3].trim();
    // Avoid duplicates
    if (!artifacts.find((a) => a.path === path)) {
      artifacts.push({ path, content, action: 'create' });
      text = text.replace(match[0], '');
    }
  }

  // Strategy 3: Match <file path="..."> ... </file> blocks
  const fileBlockRegex = /<file\s+path="([^"]+)">\s*([\s\S]*?)\s*<\/file>/g;
  while ((match = fileBlockRegex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();
    if (!artifacts.find((a) => a.path === path)) {
      artifacts.push({ path, content, action: 'create' });
      text = text.replace(match[0], '');
    }
  }

  // Strategy 4: Match generic code blocks and try to infer path from context
  // Look for patterns like "Create src/App.tsx:" or "In src/components/Header.tsx:"
  const inferredBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  while ((match = inferredBlockRegex.exec(text)) !== null) {
    const lang = match[1];
    const content = match[2].trim();
    if (content.length > 10) {
      // Try to find path reference in surrounding text
      const precedingText = text.substring(0, match.index);
      const pathMatch = precedingText.match(
        /(?:Create|Update|Modify|In|File:?\s*)\s*`?([a-zA-Z0-9_/.]+\.[a-zA-Z]+)`?\s*[:\n]/
      );
      if (pathMatch) {
        const path = pathMatch[1].trim();
        if (!artifacts.find((a) => a.path === path)) {
          artifacts.push({ path, content, action: 'create' });
        }
      }
    }
  }

  // Clean up the remaining text as the message
  const message = text
    .replace(/```\w+\n[\s\S]*?```/g, '') // remove remaining code blocks
    .replace(/\n{3,}/g, '\n\n')           // normalize whitespace
    .trim();

  return { message, artifacts };
}

/**
 * Apply a diff to existing code content.
 * Supports unified diff format and simple line-based patches.
 */
export function applyDiff(original: string, diff: string): string {
  const lines = original.split('\n');
  const diffLines = diff.split('\n');

  let i = 0; // index in diff
  let j = 0; // index in original

  while (i < diffLines.length && j <= lines.length) {
    const line = diffLines[i];

    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -start,count +start,count @@
      const hunkMatch = line.match(/@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
      if (hunkMatch) {
        j = parseInt(hunkMatch[1]) - 1; // convert to 0-index
      }
      i++;
      continue;
    }

    if (line.startsWith('-')) {
      // Remove line from original
      j++;
      i++;
      continue;
    }

    if (line.startsWith('+')) {
      // Insert new line
      lines.splice(j, 0, line.substring(1));
      j++;
      i++;
      continue;
    }

    if (line.startsWith(' ')) {
      // Context line (unchanged)
      j++;
      i++;
      continue;
    }

    // Skip empty lines and other non-diff lines
    i++;
  }

  return lines.join('\n');
}

/**
 * Generate a simple diff between two strings
 */
export function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diffs: string[] = [];

  let commonPrefix = 0;
  while (
    commonPrefix < oldLines.length &&
    commonPrefix < newLines.length &&
    oldLines[commonPrefix] === newLines[commonPrefix]
  ) {
    commonPrefix++;
  }

  let commonSuffix = 0;
  while (
    commonSuffix < oldLines.length - commonPrefix &&
    commonSuffix < newLines.length - commonPrefix &&
    oldLines[oldLines.length - 1 - commonSuffix] ===
      newLines[newLines.length - 1 - commonSuffix]
  ) {
    commonSuffix++;
  }

  const start = commonPrefix + 1;
  const oldCount = oldLines.length - commonPrefix - commonSuffix;
  const newCount = newLines.length - commonPrefix - commonSuffix;

  diffs.push(`@@ -${start},${oldCount} +${start},${newCount} @@`);

  for (let i = commonPrefix; i < oldLines.length - commonSuffix; i++) {
    diffs.push(`-${oldLines[i]}`);
  }
  for (let i = commonPrefix; i < newLines.length - commonSuffix; i++) {
    diffs.push(`+${newLines[i]}`);
  }

  return diffs.join('\n');
}
