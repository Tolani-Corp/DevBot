/**
 * AST-aware code chunker that produces semantically meaningful chunks
 * using regex-based heuristics to identify code boundaries.
 *
 * This replaces the naive line-based chunker with language-aware splitting
 * that respects function, class, interface, and block boundaries.
 */

const DEFAULT_MAX_CHUNK_SIZE = 1500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeChunk {
  content: string;
  type: "function" | "class" | "interface" | "type" | "import" | "export" | "block" | "text";
  name?: string;
  startLine: number;
  endLine: number;
  language: string;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXTENSION_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".swift": "swift",
  ".php": "php",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".xml": "xml",
  ".sql": "sql",
  ".vue": "vue",
  ".svelte": "svelte",
};

export function detectLanguage(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return "text";
  const ext = filePath.slice(dotIndex).toLowerCase();
  return EXTENSION_MAP[ext] ?? "text";
}

// ---------------------------------------------------------------------------
// Hash utility
// ---------------------------------------------------------------------------

/**
 * Simple string hash for chunk deduplication (djb2 variant).
 * Not cryptographic -- just fast and collision-resistant enough for caching.
 */
export function computeChunkHash(content: string): string {
  let h1 = 0x811c9dc5; // FNV offset basis
  let h2 = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    // FNV-1a inspired mix
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    // djb2 inspired mix for a second channel
    h2 = ((h2 << 5) + h2 + ch) | 0;
  }
  const u1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const u2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${u1}${u2}`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function chunkCode(
  content: string,
  filePath: string,
  maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE,
): CodeChunk[] {
  const language = detectLanguage(filePath);

  switch (language) {
    case "typescript":
    case "javascript":
      return chunkTypeScript(content, maxChunkSize, language);
    case "python":
      return chunkPython(content, maxChunkSize);
    default:
      return chunkGeneric(content, maxChunkSize, language);
  }
}

// ---------------------------------------------------------------------------
// TypeScript / JavaScript chunker
// ---------------------------------------------------------------------------

/**
 * Regex patterns that identify the *start* of top-level declarations in
 * TypeScript/JavaScript. The patterns intentionally match leading keywords
 * such as `export`, `async`, `default`, `abstract`, `declare`, etc.
 */
const TS_DECLARATION_RE =
  /^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|interface|type|enum)\s+/;

const TS_ARROW_CONST_RE =
  /^(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(/;

const TS_ARROW_INLINE_RE =
  /^(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(?.*\)?\s*=>/;

const TS_IMPORT_RE = /^import\s/;

const TS_EXPORT_RE = /^export\s*\{/;
const TS_EXPORT_FROM_RE = /^export\s.*\sfrom\s/;
const TS_REEXPORT_STAR_RE = /^export\s+\*/;

/**
 * Extract a name from a declaration line for labelling purposes.
 */
function extractTSName(line: string): string | undefined {
  // function / class / interface / type / enum
  const m1 = line.match(
    /(?:function\*?|class|interface|type|enum)\s+(\w+)/,
  );
  if (m1) return m1[1];

  // const foo = ...
  const m2 = line.match(/(?:const|let|var)\s+(\w+)/);
  if (m2) return m2[1];

  return undefined;
}

/**
 * Determine the chunk type from the first meaningful line.
 */
function classifyTSLine(
  trimmed: string,
): CodeChunk["type"] | null {
  if (TS_IMPORT_RE.test(trimmed)) return "import";
  if (TS_EXPORT_RE.test(trimmed) || TS_REEXPORT_STAR_RE.test(trimmed) || TS_EXPORT_FROM_RE.test(trimmed)) return "export";
  if (/(?:^|\s)class\s/.test(trimmed)) return "class";
  if (/(?:^|\s)interface\s/.test(trimmed)) return "interface";
  if (/(?:^|\s)type\s+\w+/.test(trimmed)) return "type";
  if (/(?:^|\s)(?:async\s+)?function[\s*]/.test(trimmed)) return "function";
  if (/(?:^|\s)enum\s/.test(trimmed)) return "type";

  // Arrow function assigned to const/let/var
  if (TS_ARROW_CONST_RE.test(trimmed) || TS_ARROW_INLINE_RE.test(trimmed)) return "function";

  return null;
}

export function chunkTypeScript(
  content: string,
  maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE,
  language: string = "typescript",
): CodeChunk[] {
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];

  // Intermediate representation: ranges of lines that belong together.
  interface Range {
    start: number; // 0-based line index
    end: number; // exclusive
    type: CodeChunk["type"];
    name?: string;
  }

  const ranges: Range[] = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trimStart();

    // Skip blank / comment-only lines -- they will be swept into the
    // nearest range later.
    if (trimmed === "" || trimmed.startsWith("//")) {
      i++;
      continue;
    }

    // ---- Imports ----
    // Group consecutive import lines into one chunk.
    if (TS_IMPORT_RE.test(trimmed)) {
      const start = i;
      while (i < lines.length) {
        const t = lines[i].trimStart();
        if (TS_IMPORT_RE.test(t) || t === "" || t.startsWith("//") || /^\}/.test(t) || /^['"]/.test(t)) {
          i++;
        } else {
          break;
        }
      }
      ranges.push({ start, end: i, type: "import" });
      continue;
    }

    // ---- Export blocks (re-exports) ----
    if (TS_EXPORT_RE.test(trimmed) || TS_REEXPORT_STAR_RE.test(trimmed) || TS_EXPORT_FROM_RE.test(trimmed)) {
      const start = i;
      // Might span multiple lines (export { ... \n })
      if (trimmed.includes("{") && !trimmed.includes("}")) {
        i++;
        while (i < lines.length && !lines[i].includes("}")) {
          i++;
        }
        i++; // skip the closing brace line
      } else {
        i++;
      }
      ranges.push({ start, end: i, type: "export" });
      continue;
    }

    // ---- Declarations (function, class, interface, type, enum, arrow fn) ----
    const declType = classifyTSLine(trimmed);
    if (declType !== null) {
      const start = i;
      const name = extractTSName(trimmed);

      // Collect any leading JSDoc / decorator / comment lines that
      // immediately precede this declaration.
      let effectiveStart = start;
      while (effectiveStart > 0) {
        const prev = lines[effectiveStart - 1].trimStart();
        if (
          prev.startsWith("/**") ||
          prev.startsWith("*") ||
          prev.startsWith("*/") ||
          prev.startsWith("//") ||
          prev.startsWith("@")
        ) {
          effectiveStart--;
        } else {
          break;
        }
      }
      // Only pull leading comments if they aren't already claimed.
      if (ranges.length > 0 && ranges[ranges.length - 1].end > effectiveStart) {
        effectiveStart = start;
      }

      // Walk forward tracking brace depth to find the end of the block.
      let braceDepth = 0;
      let foundOpen = false;
      let j = i;

      // For type aliases that might not use braces (e.g. `type Foo = string;`)
      // we just take until the semicolon line.
      const isSingleLineType =
        (declType === "type") && !trimmed.includes("{") && trimmed.includes(";");

      if (isSingleLineType) {
        j = i + 1;
      } else {
        for (; j < lines.length; j++) {
          const lineChars = lines[j];
          for (let c = 0; c < lineChars.length; c++) {
            const ch = lineChars[c];
            // Skip string literals (basic avoidance)
            if (ch === '"' || ch === "'" || ch === "`") {
              const quote = ch;
              c++;
              while (c < lineChars.length && lineChars[c] !== quote) {
                if (lineChars[c] === "\\") c++; // skip escaped char
                c++;
              }
              continue;
            }
            // Skip single-line comments
            if (ch === "/" && c + 1 < lineChars.length && lineChars[c + 1] === "/") {
              break; // rest of line is comment
            }
            if (ch === "{") {
              braceDepth++;
              foundOpen = true;
            } else if (ch === "}") {
              braceDepth--;
              if (foundOpen && braceDepth === 0) {
                j++; // include this line
                // Also grab a trailing semicolon line if present
                if (j < lines.length && lines[j].trimStart() === "") {
                  // don't grab blank line
                } else if (j < lines.length && /^\s*[;,]?\s*$/.test(lines[j])) {
                  j++;
                }
                break;
              }
            }
          }
          if (foundOpen && braceDepth === 0) break;
        }
        // If we never found an opening brace, just take to the next blank
        // line or semicolon.
        if (!foundOpen) {
          j = i + 1;
          while (j < lines.length) {
            const lt = lines[j].trimStart();
            if (lt === "" || lt.startsWith("export") || lt.startsWith("import") || TS_DECLARATION_RE.test(lt)) {
              break;
            }
            if (lines[j - 1].trimEnd().endsWith(";")) {
              break;
            }
            j++;
          }
        }
      }

      ranges.push({
        start: effectiveStart,
        end: j,
        type: declType,
        name,
      });
      i = j;
      continue;
    }

    // ---- Unrecognised line -- skip and let gap fill handle it ----
    i++;
  }

  // Sort ranges (they should already be sorted, but just in case).
  ranges.sort((a, b) => a.start - b.start);

  // Fill gaps between ranges with "block" or "text" chunks so that no
  // lines are lost.
  const fullRanges: Range[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      fullRanges.push({ start: cursor, end: r.start, type: "block" });
    }
    fullRanges.push(r);
    cursor = r.end;
  }
  if (cursor < lines.length) {
    fullRanges.push({ start: cursor, end: lines.length, type: "block" });
  }

  // Convert ranges to CodeChunk objects, splitting oversized chunks.
  for (const r of fullRanges) {
    const rangeContent = lines.slice(r.start, r.end).join("\n");

    // Trim-only whitespace chunks are not useful.
    if (rangeContent.trim().length === 0) continue;

    if (rangeContent.length <= maxChunkSize) {
      chunks.push({
        content: rangeContent,
        type: r.type,
        name: r.name,
        startLine: r.start + 1,
        endLine: r.end,
        language,
      });
    } else {
      // Chunk is too large -- split it by line-based sub-chunking while
      // preserving the semantic label.
      const subChunks = splitBySize(lines, r.start, r.end, maxChunkSize);
      for (const sc of subChunks) {
        chunks.push({
          content: sc.content,
          type: r.type,
          name: r.name,
          startLine: sc.startLine,
          endLine: sc.endLine,
          language,
        });
      }
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Python chunker
// ---------------------------------------------------------------------------

const PY_IMPORT_RE = /^(?:from\s|import\s)/;
const PY_DEF_RE = /^(?:async\s+)?def\s+(\w+)/;
const PY_CLASS_RE = /^class\s+(\w+)/;
const PY_DECORATOR_RE = /^@/;

export function chunkPython(
  content: string,
  maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE,
): CodeChunk[] {
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];

  interface Range {
    start: number;
    end: number;
    type: CodeChunk["type"];
    name?: string;
  }

  const ranges: Range[] = [];

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - lines[i].trimStart().length;

    // Skip blank / comment lines
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // ---- Imports ----
    if (PY_IMPORT_RE.test(trimmed) && indent === 0) {
      const start = i;
      while (i < lines.length) {
        const t = lines[i].trimStart();
        const ind = lines[i].length - lines[i].trimStart().length;
        // Continuation of import block: actual import, blank line, comment,
        // or continuation indent.
        if (PY_IMPORT_RE.test(t) || t === "" || t.startsWith("#") || ind > 0) {
          // If we see a non-import top-level statement after a blank, stop.
          if (t !== "" && !t.startsWith("#") && ind === 0 && !PY_IMPORT_RE.test(t)) {
            break;
          }
          i++;
        } else {
          break;
        }
      }
      ranges.push({ start, end: i, type: "import" });
      continue;
    }

    // ---- Decorators (attach to the following def/class) ----
    if (PY_DECORATOR_RE.test(trimmed) && indent === 0) {
      const start = i;
      i++;
      // Consume decorator stack
      while (i < lines.length) {
        const t = lines[i].trimStart();
        if (PY_DECORATOR_RE.test(t) || t === "" || t.startsWith("#")) {
          i++;
        } else {
          break;
        }
      }
      // The next non-blank/comment line should be a def or class.
      // Fall through so the def/class match below grabs it. We'll pull
      // the decorator start into that range.
      if (i < lines.length) {
        const next = lines[i].trimStart();
        const defMatch = next.match(PY_DEF_RE);
        const clsMatch = next.match(PY_CLASS_RE);
        if (defMatch || clsMatch) {
          const name = defMatch ? defMatch[1] : clsMatch![1];
          const type: CodeChunk["type"] = defMatch ? "function" : "class";
          // Walk the indented body
          i++;
          while (i < lines.length) {
            const li = lines[i];
            const liTrimmed = li.trimStart();
            const liIndent = li.length - liTrimmed.length;
            // Blank lines within a body are fine
            if (liTrimmed === "") {
              i++;
              continue;
            }
            // Still inside the block if indented
            if (liIndent > 0) {
              i++;
            } else {
              break;
            }
          }
          ranges.push({ start, end: i, type, name });
          continue;
        }
      }
      // If decorators weren't followed by def/class, treat them as a block.
      ranges.push({ start, end: i, type: "block" });
      continue;
    }

    // ---- def / class at top-level ----
    const defMatch = trimmed.match(PY_DEF_RE);
    const clsMatch = trimmed.match(PY_CLASS_RE);
    if ((defMatch || clsMatch) && indent === 0) {
      const start = i;
      const name = defMatch ? defMatch[1] : clsMatch![1];
      const type: CodeChunk["type"] = defMatch ? "function" : "class";

      // Collect leading comments / docstrings
      let effectiveStart = start;
      while (effectiveStart > 0) {
        const prev = lines[effectiveStart - 1].trimStart();
        if (prev.startsWith("#") || prev === "") {
          effectiveStart--;
        } else {
          break;
        }
      }
      if (ranges.length > 0 && ranges[ranges.length - 1].end > effectiveStart) {
        effectiveStart = start;
      }

      // Walk the indented body
      i++;
      while (i < lines.length) {
        const li = lines[i];
        const liTrimmed = li.trimStart();
        const liIndent = li.length - liTrimmed.length;
        if (liTrimmed === "") {
          i++;
          continue;
        }
        if (liIndent > 0) {
          i++;
        } else {
          break;
        }
      }
      ranges.push({ start: effectiveStart, end: i, type, name });
      continue;
    }

    // Unrecognised -- skip
    i++;
  }

  // Sort and fill gaps (same strategy as TS chunker).
  ranges.sort((a, b) => a.start - b.start);

  const fullRanges: Range[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      fullRanges.push({ start: cursor, end: r.start, type: "block" });
    }
    fullRanges.push(r);
    cursor = r.end;
  }
  if (cursor < lines.length) {
    fullRanges.push({ start: cursor, end: lines.length, type: "block" });
  }

  for (const r of fullRanges) {
    const rangeContent = lines.slice(r.start, r.end).join("\n");
    if (rangeContent.trim().length === 0) continue;

    if (rangeContent.length <= maxChunkSize) {
      chunks.push({
        content: rangeContent,
        type: r.type,
        name: r.name,
        startLine: r.start + 1,
        endLine: r.end,
        language: "python",
      });
    } else {
      const subChunks = splitBySize(lines, r.start, r.end, maxChunkSize);
      for (const sc of subChunks) {
        chunks.push({
          content: sc.content,
          type: r.type,
          name: r.name,
          startLine: sc.startLine,
          endLine: sc.endLine,
          language: "python",
        });
      }
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Generic / fallback chunker
// ---------------------------------------------------------------------------

export function chunkGeneric(
  content: string,
  maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE,
  language?: string,
): CodeChunk[] {
  const lang = language ?? "text";
  const chunks: CodeChunk[] = [];

  // Split on blank lines to form paragraphs / logical groups.
  const lines = content.split("\n");
  const paragraphs: { start: number; end: number }[] = [];
  let pStart = 0;

  for (let i = 0; i <= lines.length; i++) {
    const isBlank = i === lines.length || lines[i].trim() === "";
    if (isBlank) {
      if (i > pStart) {
        paragraphs.push({ start: pStart, end: i });
      }
      pStart = i + 1;
    }
  }

  // Merge small paragraphs together until they approach maxChunkSize.
  let currentStart = -1;
  let currentEnd = -1;
  let currentLen = 0;

  const flush = () => {
    if (currentStart === -1) return;
    const text = lines.slice(currentStart, currentEnd).join("\n");
    if (text.trim().length > 0) {
      chunks.push({
        content: text,
        type: "text",
        startLine: currentStart + 1,
        endLine: currentEnd,
        language: lang,
      });
    }
    currentStart = -1;
    currentEnd = -1;
    currentLen = 0;
  };

  for (const p of paragraphs) {
    const pText = lines.slice(p.start, p.end).join("\n");
    const pLen = pText.length;

    if (pLen > maxChunkSize) {
      // Flush anything accumulated so far.
      flush();
      // This paragraph itself is larger than the limit -- break it by lines.
      const subChunks = splitBySize(lines, p.start, p.end, maxChunkSize);
      for (const sc of subChunks) {
        chunks.push({
          content: sc.content,
          type: "text",
          startLine: sc.startLine,
          endLine: sc.endLine,
          language: lang,
        });
      }
      continue;
    }

    if (currentStart === -1) {
      currentStart = p.start;
      currentEnd = p.end;
      currentLen = pLen;
    } else if (currentLen + 1 + pLen <= maxChunkSize) {
      // Merge into current accumulator (the +1 accounts for the joining newline).
      currentEnd = p.end;
      currentLen += 1 + pLen;
    } else {
      flush();
      currentStart = p.start;
      currentEnd = p.end;
      currentLen = pLen;
    }
  }
  flush();

  return chunks;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface SubChunk {
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Line-based splitting for oversized ranges. Keeps each sub-chunk under
 * `maxSize` characters when possible.
 */
function splitBySize(
  lines: string[],
  start: number,
  end: number,
  maxSize: number,
): SubChunk[] {
  const result: SubChunk[] = [];
  let chunkStart = start;
  let current = "";

  for (let i = start; i < end; i++) {
    const addition = current.length === 0 ? lines[i] : "\n" + lines[i];

    if (current.length + addition.length > maxSize && current.length > 0) {
      result.push({
        content: current,
        startLine: chunkStart + 1,
        endLine: i,
      });
      current = lines[i];
      chunkStart = i;
    } else {
      current += addition;
    }
  }

  if (current.trim().length > 0) {
    result.push({
      content: current,
      startLine: chunkStart + 1,
      endLine: end,
    });
  }

  return result;
}
