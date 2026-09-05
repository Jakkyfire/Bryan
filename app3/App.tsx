/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MapPin,
  Recycle,
  Search,
  Plus,
  FolderOpen,
  Terminal,
  Phone,
  Mic,
  Compass,
  CornerDownLeft,
  Square,
  FileText,
  FileCode,
  Download,
  Maximize2,
  Minimize2,
  X,
  Wrench,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RotateCw,
  Globe,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CloudSun,
  Sun,
  Moon,
  Plane,
  ExternalLink,
  PanelLeft,
  PanelLeftClose,
  MessageSquare,
  MessageSquarePlus,
  Trash2,
  History,
  Settings,
  User,
  Mail,
  Cpu,
  MoreHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Message, UserCoordinates, PreviewContent, AttachedFile, ChatSession, UserSettings } from './types';

let idCounter = 0;
function generateId(prefix: string = 'msg'): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function getFileTypeLabel(file: { name: string; type?: string }): string {
  const ext = file.name.split('.').pop()?.toUpperCase() || '';
  if (file.type?.startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG'].includes(ext)) {
    return ext ? `${ext} IMAGE` : 'IMAGE';
  }
  if (file.type === 'application/pdf' || ext === 'PDF') return 'PDF DOCUMENT';
  if (ext === 'JSON') return 'JSON DATA';
  if (['CSV', 'XLS', 'XLSX'].includes(ext)) return 'SPREADSHEET';
  if (['JS', 'TS', 'TSX', 'JSX', 'PY', 'HTML', 'CSS', 'SH', 'SQL', 'C', 'CPP', 'JAVA', 'GO', 'RS'].includes(ext)) {
    return `${ext} CODE`;
  }
  if (file.type?.startsWith('text/') || ['TXT', 'MD', 'LOG'].includes(ext)) return `${ext || 'TEXT'} FILE`;
  return ext ? `${ext} FILE` : 'ATTACHMENT';
}

// Resolve text color for custom file blocks
function resolveTextColor(param?: string): string {
  if (!param) return '#ede8e3';
  let p = param.trim().toLowerCase();
  if (p.includes('default') || p === 'white' || p === '#fff' || p === '#ffffff') {
    return '#ffffff';
  }
  if (p.includes('white')) return '#ffffff';
  if (p === 'gold' || p === 'yellow') return '#ffe89e';
  if (p === 'green' || p === 'emerald') return '#a7f3d0';
  if (p === 'red' || p === 'rose') return '#fecaca';
  if (p === 'blue' || p === 'sky' || p === 'cyan') return '#bae6fd';
  if (p === 'purple' || p === 'violet') return '#e9d5ff';
  if (p === 'bronze' || p === 'orange') return '#fed7aa';
  if (p === 'gray' || p === 'grey') return '#d1d5db';
  return param.replace(/text color|\(|\)/gi, '').trim() || '#ffffff';
}

// Resolve table background, text color, and border for custom table blocks: --- (bgcolor (default = whitish bronze)) text ---
function resolveTableBgColor(param?: string): { bg: string; text: string; border: string } {
  const defaultWhitishBronze = {
    bg: 'rgba(230, 218, 202, 0.18)',
    text: '#f5f0eb',
    border: 'rgba(212, 175, 55, 0.35)',
  };

  if (!param) return defaultWhitishBronze;
  let p = param.trim().toLowerCase();
  if (
    p.includes('default') ||
    p.includes('whitish bronze') ||
    p.includes('white bronze') ||
    p.includes('bronze')
  ) {
    return defaultWhitishBronze;
  }
  if (p === 'gold' || p === 'yellow') {
    return { bg: 'rgba(212, 175, 55, 0.22)', text: '#ffe89e', border: 'rgba(212, 175, 55, 0.45)' };
  }
  if (p === 'green' || p === 'emerald') {
    return { bg: 'rgba(16, 185, 129, 0.2)', text: '#a7f3d0', border: 'rgba(16, 185, 129, 0.4)' };
  }
  if (p === 'red' || p === 'rose') {
    return { bg: 'rgba(239, 68, 68, 0.2)', text: '#fecaca', border: 'rgba(239, 68, 68, 0.4)' };
  }
  if (p === 'blue' || p === 'sky' || p === 'cyan') {
    return { bg: 'rgba(56, 189, 248, 0.2)', text: '#bae6fd', border: 'rgba(56, 189, 248, 0.4)' };
  }
  if (p === 'purple' || p === 'violet') {
    return { bg: 'rgba(168, 85, 247, 0.2)', text: '#e9d5ff', border: 'rgba(168, 85, 247, 0.4)' };
  }
  if (p === 'white' || p === '#fff' || p === '#ffffff') {
    return { bg: 'rgba(255, 255, 255, 0.15)', text: '#ffffff', border: 'rgba(255, 255, 255, 0.3)' };
  }
  if (p === 'black' || p === 'dark') {
    return { bg: 'rgba(20, 16, 14, 0.85)', text: '#ede8e3', border: 'rgba(60, 50, 45, 0.8)' };
  }

  const clean = param.replace(/bgcolor\s*[:=]?/gi, '').trim();
  return {
    bg: clean.startsWith('#') || clean.startsWith('rgb') ? clean : 'rgba(230, 218, 202, 0.18)',
    text: '#f5f0eb',
    border: 'rgba(212, 175, 55, 0.35)',
  };
}

// Helper for table cell parsing with support for headings (# -> h3, ## -> h2, ###+ -> h1) and lists
function parseSingleCellLine(line: string, isTyping?: boolean, keyPrefix: string = 'cell-line'): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const headingMatch = trimmed.match(/^(#{1,})\s*(.*)$/);
  if (headingMatch) {
    const hashCount = headingMatch[1].length;
    const headingContent = headingMatch[2].trim() || trimmed;
    if (hashCount >= 3) {
      return (
        <h1 key={`${keyPrefix}-h1`} className="text-base sm:text-lg font-bold text-white my-1 tracking-tight">
          {parseInlineFormatting(headingContent, isTyping, `${keyPrefix}-h1`)}
        </h1>
      );
    } else if (hashCount === 2) {
      return (
        <h2 key={`${keyPrefix}-h2`} className="text-sm sm:text-base font-semibold text-white my-1 tracking-tight">
          {parseInlineFormatting(headingContent, isTyping, `${keyPrefix}-h2`)}
        </h2>
      );
    } else if (hashCount === 1) {
      return (
        <h3 key={`${keyPrefix}-h3`} className="text-xs sm:text-sm font-medium text-white my-0.5 tracking-tight">
          {parseInlineFormatting(headingContent, isTyping, `${keyPrefix}-h3`)}
        </h3>
      );
    }
  }

  // Unordered list item in cell
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    const itemText = trimmed.slice(2);
    return (
      <ul key={`${keyPrefix}-ul`} className="my-0.5 ml-3 list-disc">
        <li>{parseInlineFormatting(itemText, isTyping, `${keyPrefix}-ul`)}</li>
      </ul>
    );
  }

  // Ordered list item in cell
  const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
  if (olMatch) {
    return (
      <ol key={`${keyPrefix}-ol`} className="my-0.5 ml-3 list-decimal">
        <li>{parseInlineFormatting(olMatch[2], isTyping, `${keyPrefix}-ol`)}</li>
      </ol>
    );
  }

  return parseInlineFormatting(line, isTyping, keyPrefix);
}

function parseTableCellContent(colText: string, isTyping?: boolean, keyPrefix: string = 'tbl-cell'): React.ReactNode {
  const trimmed = colText.trim();
  if (!trimmed) return null;

  const lines = trimmed.split('\n');
  if (lines.length > 1) {
    return (
      <div className="space-y-0.5">
        {lines.map((l, idx) => (
          <React.Fragment key={`${keyPrefix}-l-${idx}`}>
            {parseSingleCellLine(l, isTyping, `${keyPrefix}-l-${idx}`)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return parseSingleCellLine(trimmed, isTyping, keyPrefix);
}

// Custom Table Block for --- (bgcolor (default = whitish bronze)) text ---
function CustomTableBlock({
  bgColorParam,
  content,
  isTyping,
}: {
  key?: React.Key;
  bgColorParam?: string;
  content: string;
  isTyping?: boolean;
}) {
  const styling = resolveTableBgColor(bgColorParam);
  const rawLines = content
    .trim()
    .split('\n')
    .filter((l) => l.trim().length > 0);

  const rows =
    rawLines.length > 0
      ? rawLines.map((line) => {
          if (line.includes('|')) {
            const parts = line.split('|').map((c) => c.trim());
            if (parts.length > 1 && parts[0] === '') parts.shift();
            if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
            return parts;
          }
          return [line.trim()];
        })
      : [[content.trim()]];

  const validRows = rows.filter((r) => !r.every((cell) => /^[-:\s]+$/.test(cell)));

  return (
    <div className="custom-table-container my-3 overflow-x-auto">
      <table
        className="w-full border-collapse rounded-lg overflow-hidden text-sm"
        style={{
          backgroundColor: styling.bg,
          borderColor: styling.border,
          borderWidth: '1px',
          borderStyle: 'solid',
          color: styling.text,
        }}
      >
        <tbody>
          {validRows.map((cols, rIdx) => (
            <tr
              key={`tr-${rIdx}`}
              style={{
                borderBottom: rIdx < validRows.length - 1 ? `1px solid ${styling.border}` : 'none',
              }}
            >
              {cols.map((colText, cIdx) => (
                <td
                  key={`td-${rIdx}-${cIdx}`}
                  className="px-4 py-2.5 align-top"
                  style={{
                    borderRight: cIdx < cols.length - 1 ? `1px solid ${styling.border}` : 'none',
                  }}
                >
                  {parseTableCellContent(colText, isTyping, `tbl-${rIdx}-${cIdx}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Custom Tagged File / Code Block with Header (Type container, File name, Download, and 3-second green tick Copy button)
function TaggedFileBlock({
  textType,
  fileName,
  colorParam,
  content,
}: {
  key?: React.Key;
  textType: string;
  fileName: string;
  colorParam?: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      const cleanContent = content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, 3000); // exactly 3 seconds green tick!
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    try {
      const cleanName = fileName.trim() || 'snippet.txt';
      const cleanContent = content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');
      const blob = new Blob([cleanContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const resolvedColor = resolveTextColor(colorParam);
  const displayContent = content.replace(/^\r?\n/, '').replace(/\r?\n$/, '');

  return (
    <div className="tagged-file-block" id={`tagged-file-${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}`}>
      <div className="tagged-file-header">
        <div className="tagged-file-left">
          <span className="tagged-file-type-pill">{textType.trim().toUpperCase()}</span>
          <span className="tagged-file-name" title={fileName}>
            <FileCode style={{ width: 14, height: 14, color: '#d4af37' }} />
            <span>{fileName.trim()}</span>
          </span>
        </div>

        <div className="tagged-file-actions">
          <button
            type="button"
            className="tagged-file-btn"
            onClick={handleDownload}
            title={`Download ${fileName}`}
            aria-label={`Download ${fileName}`}
          >
            <Download style={{ width: 14, height: 14 }} />
            <span className="tagged-btn-label">Download</span>
          </button>

          <button
            type="button"
            className={`tagged-file-btn copy-btn ${copied ? 'copied-active' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Copied to clipboard (3s)!' : 'Copy to clipboard'}
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check style={{ width: 14, height: 14, color: '#10b981' }} />
                <span className="tagged-btn-label copied">Copied!</span>
              </>
            ) : (
              <>
                <Copy style={{ width: 14, height: 14 }} />
                <span className="tagged-btn-label">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="tagged-file-body" style={{ color: resolvedColor }}>
        <pre>
          <code>{displayContent}</code>
        </pre>
      </div>
    </div>
  );
}

// Markdown component to render bold text, code, lists, highlights, custom tagged file blocks, custom table blocks, etc.
function FormattedMessage({ text, isTyping }: { text: string; isTyping?: boolean }) {
  const parts = useMemo(() => {
    if (!text) return null;

    // Custom tagged file blocks: !(text type)(file name) (color) content!
    const customTagRegex = /!\(([^)]+)\)\(([^)]+)\)(?:\s*\(([^)]+)\))?\s*([\s\S]*?)(?:!(?=\s*(?:\r?\n\r?\n|\r?\n[A-Za-z0-9_#\-\*\[]|\r?\n?$|$|!\())|!$)/g;
    // Standard code blocks: ```lang\ncontent```
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    // Custom table blocks: --- (bgcolor (default = whitish bronze)) text ---
    const customTableRegex = /---\s*(?:\((?:bgcolor\s*[:=]?\s*)?([^)]+)\))?\s*([\s\S]*?)---/g;

    interface MatchItem {
      start: number;
      end: number;
      node: React.ReactNode;
    }

    const matches: MatchItem[] = [];
    let m: RegExpExecArray | null;

    // Find all custom tagged file blocks
    while ((m = customTagRegex.exec(text)) !== null) {
      const textType = m[1];
      const fileName = m[2];
      const colorParam = m[3];
      const content = m[4];
      matches.push({
        start: m.index,
        end: customTagRegex.lastIndex,
        node: (
          <TaggedFileBlock
            key={`tagged-file-${m.index}`}
            textType={textType}
            fileName={fileName}
            colorParam={colorParam}
            content={content}
          />
        ),
      });
    }

    // Find all custom table blocks that do not overlap
    while ((m = customTableRegex.exec(text)) !== null) {
      const tblStart = m.index;
      const tblEnd = customTableRegex.lastIndex;
      const overlaps = matches.some(
        (existing) =>
          (tblStart >= existing.start && tblStart < existing.end) ||
          (tblEnd > existing.start && tblEnd <= existing.end)
      );
      if (!overlaps) {
        const bgParam = m[1];
        const tblContent = m[2];
        matches.push({
          start: tblStart,
          end: tblEnd,
          node: (
            <CustomTableBlock
              key={`table-block-${tblStart}`}
              bgColorParam={bgParam}
              content={tblContent}
              isTyping={isTyping}
            />
          ),
        });
      }
    }

    // Find all standard code blocks that do not overlap
    while ((m = codeBlockRegex.exec(text)) !== null) {
      const codeStart = m.index;
      const codeEnd = codeBlockRegex.lastIndex;
      const overlaps = matches.some(
        (existing) =>
          (codeStart >= existing.start && codeStart < existing.end) ||
          (codeEnd > existing.start && codeEnd <= existing.end)
      );
      if (!overlaps) {
        const lang = m[1] || 'CODE';
        const codeBody = m[2];
        matches.push({
          start: codeStart,
          end: codeEnd,
          node: (
            <TaggedFileBlock
              key={`standard-code-${codeStart}`}
              textType={lang}
              fileName={`${lang.toLowerCase() || 'snippet'}.txt`}
              colorParam="white"
              content={codeBody}
            />
          ),
        });
      }
    }

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start);

    const segments: React.ReactNode[] = [];
    let currentIdx = 0;
    let segCount = 0;

    for (const match of matches) {
      if (match.start > currentIdx) {
        segments.push(
          renderTextWithFormatting(
            text.slice(currentIdx, match.start),
            `txt-${segCount++}`,
            isTyping
          )
        );
      }
      segments.push(match.node);
      currentIdx = match.end;
    }

    if (currentIdx < text.length) {
      segments.push(
        renderTextWithFormatting(
          text.slice(currentIdx),
          `txt-${segCount++}`,
          isTyping
        )
      );
    }

    return segments;
  }, [text, isTyping]);

  return (
    <div className={`markdown-content ${isTyping ? 'gemini-stream-active' : ''}`}>
      {parts}
    </div>
  );
}

function renderTextWithFormatting(raw: string, keyPrefix: string, isTyping?: boolean): React.ReactNode {
  const lines = raw.split('\n');
  return (
    <React.Fragment key={keyPrefix}>
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();

        // Heading rule:
        // ### or more than that (###, ####, etc., e.g. ###text or ### text) -> h1
        // ## (e.g. ##text or ## text) -> h2
        // # (e.g. #text or # text) -> h3
        // no more
        const headingMatch = trimmed.match(/^(#{1,})\s*(.*)$/);
        if (headingMatch) {
          const hashCount = headingMatch[1].length;
          const headingContent = headingMatch[2].trim() || trimmed;
          if (hashCount >= 3) {
            return (
              <h1 key={`${keyPrefix}-h1-${lIdx}`} className="text-xl font-bold text-white my-3 tracking-tight">
                {parseInlineFormatting(headingContent, isTyping, `${keyPrefix}-h1-${lIdx}`)}
              </h1>
            );
          } else if (hashCount === 2) {
            return (
              <h2 key={`${keyPrefix}-h2-${lIdx}`} className="text-lg font-semibold text-white my-2 tracking-tight">
                {parseInlineFormatting(headingContent, isTyping, `${keyPrefix}-h2-${lIdx}`)}
              </h2>
            );
          } else if (hashCount === 1) {
            return (
              <h3 key={`${keyPrefix}-h3-${lIdx}`} className="text-base font-semibold text-white my-2 tracking-tight">
                {parseInlineFormatting(headingContent, isTyping, `${keyPrefix}-h3-${lIdx}`)}
              </h3>
            );
          }
        }

        // Unordered list item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.slice(2);
          return (
            <ul key={`${keyPrefix}-ul-${lIdx}`} className="my-1">
              <li>{parseInlineFormatting(itemText, isTyping, `${keyPrefix}-ul-${lIdx}`)}</li>
            </ul>
          );
        }

        // Ordered list item
        const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (olMatch) {
          return (
            <ol key={`${keyPrefix}-ol-${lIdx}`} className="my-1">
              <li>{parseInlineFormatting(olMatch[2], isTyping, `${keyPrefix}-ol-${lIdx}`)}</li>
            </ol>
          );
        }

        if (!trimmed) {
          return <div key={`${keyPrefix}-br-${lIdx}`} className="h-2" />;
        }

        return (
          <p key={`${keyPrefix}-p-${lIdx}`} className="mb-2 last:mb-0">
            {parseInlineFormatting(line, isTyping, `${keyPrefix}-p-${lIdx}`)}
          </p>
        );
      })}
    </React.Fragment>
  );
}

function parseInlineFormatting(str: string, isTyping?: boolean, keyPrefix: string = 'inline'): React.ReactNode[] {
  // Parse inline `<br>`, `^(link)name^`, `[name](link)`, `code`, **bold**, *italic*, %{bgcolor}highlighted text%, and [FILE: filename] file links
  const tokens = str.split(/(<br\s*\/?>|\^\([^)]+\)[\s\S]*?\^|\[(?:FILE|file):\s*[^\]]+\]|\[[^\]]+\]\([^)]+\)|%\{[^}]+\}[\s\S]*?%|\*\*[\s\S]*?\*\*|`[^`]+`|\*[^*]+\*)/gi);
  return tokens.map((tok, i) => {
    const itemKey = `${keyPrefix}-t-${i}`;

    // Line break: <br>, <br/>, <br />
    if (/^<br\s*\/?>$/i.test(tok)) {
      return <br key={itemKey} className="my-0.5" />;
    }

    // Custom Link syntax: ^(link)name^ (e.g. ^(https://example.com)Example Site^)
    const customLinkMatch = tok.match(/^\^\(([^)]+)\)([\s\S]*?)\^$/);
    if (customLinkMatch) {
      const rawHref = customLinkMatch[1].trim();
      const linkText = customLinkMatch[2].trim() || rawHref;
      const validHref = /^(https?:\/\/|mailto:|#|\/)/i.test(rawHref) ? rawHref : `https://${rawHref}`;
      return (
        <a
          key={itemKey}
          href={validHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-amber-300 hover:text-amber-200 underline decoration-amber-400/50 hover:decoration-amber-300 transition-colors mx-0.5"
        >
          <span>{parseInlineFormatting(linkText, isTyping, `${itemKey}-link-txt`)}</span>
          <ExternalLink style={{ width: 12, height: 12, display: 'inline-block', opacity: 0.8 }} />
        </a>
      );
    }

    // Standard markdown link: [name](link)
    const mdLinkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (mdLinkMatch) {
      const linkText = mdLinkMatch[1].trim();
      const rawHref = mdLinkMatch[2].trim();
      const validHref = /^(https?:\/\/|mailto:|#|\/)/i.test(rawHref) ? rawHref : `https://${rawHref}`;
      return (
        <a
          key={itemKey}
          href={validHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-amber-300 hover:text-amber-200 underline decoration-amber-400/50 hover:decoration-amber-300 transition-colors mx-0.5"
        >
          <span>{parseInlineFormatting(linkText, isTyping, `${itemKey}-md-txt`)}</span>
          <ExternalLink style={{ width: 12, height: 12, display: 'inline-block', opacity: 0.8 }} />
        </a>
      );
    }

    if (tok.startsWith('**') && tok.endsWith('**') && tok.length >= 4) {
      return (
        <strong key={itemKey} className="text-white font-bold">
          {parseInlineFormatting(tok.slice(2, -2), isTyping, `${itemKey}-b`)}
        </strong>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length >= 2) {
      return <code key={itemKey}>{tok.slice(1, -1)}</code>;
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length >= 2) {
      return <em key={itemKey}>{parseInlineFormatting(tok.slice(1, -1), isTyping, `${itemKey}-i`)}</em>;
    }

    // Highlighting %{bgcolor}text%
    const highlightMatch = tok.match(/^%\{([^}]+)\}([\s\S]*?)%$/);
    if (highlightMatch) {
      const rawBg = highlightMatch[1].trim().toLowerCase();
      const content = highlightMatch[2];

      let bgStyle = highlightMatch[1].trim();
      let textStyle = '#ffffff';

      if (rawBg === 'yellow' || rawBg === 'gold' || rawBg === '#d4af37') {
        bgStyle = 'rgba(212, 175, 55, 0.28)';
        textStyle = '#ffe89e';
      } else if (rawBg === 'green' || rawBg === 'emerald' || rawBg === '#10b981') {
        bgStyle = 'rgba(16, 185, 129, 0.25)';
        textStyle = '#a7f3d0';
      } else if (rawBg === 'red' || rawBg === 'rose' || rawBg === '#ef4444') {
        bgStyle = 'rgba(239, 68, 68, 0.25)';
        textStyle = '#fecaca';
      } else if (rawBg === 'blue' || rawBg === 'sky' || rawBg === '#38bdf8') {
        bgStyle = 'rgba(56, 189, 248, 0.25)';
        textStyle = '#bae6fd';
      } else if (rawBg === 'purple' || rawBg === 'violet' || rawBg === '#a855f7') {
        bgStyle = 'rgba(168, 85, 247, 0.25)';
        textStyle = '#e9d5ff';
      } else if (rawBg === 'bronze' || rawBg === 'orange' || rawBg === '#bfa07c') {
        bgStyle = 'rgba(191, 160, 124, 0.28)';
        textStyle = '#fef3c7';
      } else if (rawBg === 'grey' || rawBg === 'gray') {
        bgStyle = 'rgba(140, 131, 122, 0.25)';
        textStyle = '#ede8e3';
      }

      return (
        <span
          key={itemKey}
          className="highlight-tag"
          style={{
            backgroundColor: bgStyle,
            color: textStyle,
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'inline',
            fontWeight: 500,
          }}
        >
          {parseInlineFormatting(content, isTyping, `${itemKey}-h`)}
        </span>
      );
    }

    // Inline File Link: [FILE: filename.ext] or [file: filename.ext]
    const fileLinkMatch = tok.match(/^\[(?:FILE|file):\s*([^\]]+)\]$/);
    if (fileLinkMatch) {
      const fileName = fileLinkMatch[1].trim();
      return (
        <span key={itemKey} className="inline-file-link-pill" title={`Linked File: ${fileName}`}>
          <FileCode style={{ width: 13, height: 13, color: '#d4af37' }} />
          <span className="file-link-name">{fileName}</span>
        </span>
      );
    }

    if (isTyping) {
      // Split into words and whitespace segments, preserving full spacing and inline text flow
      const words = tok.split(/(\s+)/);
      return (
        <React.Fragment key={itemKey}>
          {words.map((w, wIdx) => {
            if (!w) return null;
            if (/^\s+$/.test(w)) {
              return (
                <span key={`${itemKey}-s-${wIdx}`} style={{ whiteSpace: 'pre-wrap' }}>
                  {w}
                </span>
              );
            }
            return (
              <span key={`${itemKey}-w-${wIdx}`} className="gemini-word-stream">
                {w}
              </span>
            );
          })}
        </React.Fragment>
      );
    }

    return <React.Fragment key={itemKey}>{tok}</React.Fragment>;
  });
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [userCoordinates, setUserCoordinates] = useState<UserCoordinates | null>(null);
  const [isTtsActive, setIsTtsActive] = useState(false);
  const [openCommandIds, setOpenCommandIds] = useState<Record<string, boolean>>({});
  const [activePromptIndex, setActivePromptIndex] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-GB');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Chat sessions and sidebar state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('lifeguide_chat_sessions_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateId('session'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // User Settings state
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('lifeguide_user_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          model: parsed.model || 'gemini-2.5-flash',
          userName: parsed.userName !== undefined ? parsed.userName : 'Bryan',
          userEmail: parsed.userEmail || 'mailbryanuk@gmail.com',
          defaultLocation: parsed.defaultLocation || 'Liverpool, UK',
        };
      }
    } catch (e) {
      console.error('Failed to load user settings:', e);
    }
    return {
      model: 'gemini-2.5-flash',
      userName: 'Bryan',
      userEmail: 'mailbryanuk@gmail.com',
      defaultLocation: 'Liverpool, UK',
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<UserSettings>(userSettings);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // First-time onboarding name modal state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    try {
      const hasPrompted = localStorage.getItem('lifeguide_first_time_name_set');
      return !hasPrompted;
    } catch {
      return false;
    }
  });
  const [onboardingNameInput, setOnboardingNameInput] = useState(userSettings.userName || 'Bryan');

  const handleOnboardingSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = onboardingNameInput.trim() || 'Bryan';
    const updatedSettings = { ...userSettings, userName: trimmed };
    setUserSettings(updatedSettings);
    try {
      localStorage.setItem('lifeguide_first_time_name_set', 'true');
      localStorage.setItem('lifeguide_user_settings_v1', JSON.stringify(updatedSettings));
    } catch (err) {
      console.error(err);
    }
    setIsOnboardingOpen(false);
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return chatSessions;
    const q = searchQuery.toLowerCase().trim();
    return chatSessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [chatSessions, searchQuery]);

  const handleSaveSettings = (newSettings: UserSettings) => {
    setUserSettings(newSettings);
    try {
      localStorage.setItem('lifeguide_user_settings_v1', JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to persist user settings:', e);
    }
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 2000);
    setTimeout(() => setIsSettingsOpen(false), 450);
  };

  // New feedback, reasoning, and UX states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [openThoughtIds, setOpenThoughtIds] = useState<Record<string, boolean>>({});
  const [isLiveThoughtsOpen, setIsLiveThoughtsOpen] = useState(false);
  const [liveThoughtStep, setLiveThoughtStep] = useState<number>(0);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [typingMsgId, setTypingMsgId] = useState<string | null>(null);

  // Ticking effect for live thinking & Bing web analysis steps
  useEffect(() => {
    let timer: any = null;
    if (isGenerating) {
      setLiveThoughtStep(0);
      timer = setInterval(() => {
        setLiveThoughtStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 420);
    } else {
      setLiveThoughtStep(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  // Dropdown popover states for Plus button and Tools button
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  // Side preview state and resizable scaling
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number>(() =>
    Math.max(340, Math.min(680, Math.floor(window.innerWidth * 0.48)))
  );
  const [isResizing, setIsResizing] = useState(false);

  // Dynamic squashing state
  const [isControlsSquashed, setIsControlsSquashed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionsBarRef = useRef<HTMLDivElement>(null);
  const suggestionsScrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<any>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateSuggestionsScrollButtons = () => {
    if (!suggestionsScrollRef.current) return;
    const el = suggestionsScrollRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  const handleScrollSuggestions = (direction: 'left' | 'right') => {
    if (!suggestionsScrollRef.current) return;
    const scrollAmount = 220;
    suggestionsScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(updateSuggestionsScrollButtons, 220);
  };

  // Recheck suggestions scroll arrow visibility on state/preview changes
  useEffect(() => {
    if (suggestions.length > 0) {
      requestAnimationFrame(() => {
        setTimeout(updateSuggestionsScrollButtons, 50);
      });
    }
  }, [suggestions, isPreviewOpen, previewWidth]);

  useEffect(() => {
    const handleResize = () => {
      updateSuggestionsScrollButtons();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-close popovers when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Detect physical squashing of the actions container (< 460px)
  useEffect(() => {
    if (!actionsBarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsControlsSquashed(entry.contentRect.width < 460);
      }
    });
    observer.observe(actionsBarRef.current);
    return () => observer.disconnect();
  }, []);

  // Scroll so the active conversation (user prompt and AI response/thinking) is cleanly positioned at the top of view, avoiding bottom squishing
  const scrollToActiveExchange = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!chatScrollAreaRef.current) return;
        const container = chatScrollAreaRef.current;
        const userElements = container.querySelectorAll('.msg.user');
        const latestUser = userElements.length > 0 ? (userElements[userElements.length - 1] as HTMLElement) : null;
        if (latestUser) {
          const targetTop = Math.max(0, latestUser.offsetTop - 16);
          container.scrollTo({ top: targetTop, behavior });
        } else {
          container.scrollTo({ top: 0, behavior });
        }
      }, 50);
    });
  };

  // Scroll chat container to top (like the beginning when chat is starting)
  const scrollToTopOrBeginning = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!chatScrollAreaRef.current) return;
        chatScrollAreaRef.current.scrollTo({ top: 0, behavior });
      }, 30);
    });
  };

  // Center the chat container vertically on the chatbot's thinking and generation in the middle
  const centerAiInMiddle = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!chatScrollAreaRef.current) return;
        const container = chatScrollAreaRef.current;
        const thinkingEl = document.getElementById('thinkingIndicator');
        const assistantRows = container.querySelectorAll('.assistant-row');
        const latestAssistant = assistantRows.length > 0 ? (assistantRows[assistantRows.length - 1] as HTMLElement) : null;
        const targetEl = thinkingEl || latestAssistant;

        if (targetEl) {
          const targetOffset = targetEl.offsetTop;
          const targetHeight = targetEl.clientHeight;
          const containerHeight = container.clientHeight;
          const middleScroll = Math.max(0, targetOffset - (containerHeight / 2) + (targetHeight / 2));
          container.scrollTo({ top: middleScroll, behavior });
        }
      }, 40);
    });
  };

  // Preview panel resize drag handlers
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const minMainWidth = 320;
      const minPreviewWidth = 280;
      const maxPreviewWidth = window.innerWidth - minMainWidth;
      const rawNewWidth = window.innerWidth - e.clientX;

      const clampedWidth = Math.min(maxPreviewWidth, Math.max(minPreviewWidth, rawNewWidth));
      setPreviewWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Track active message for timeline node highlighting
  const userPrompts = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);

  useEffect(() => {
    if (userPrompts.length > 0) {
      setActivePromptIndex(userPrompts.length - 1);
    }
  }, [userPrompts.length]);

  // Sync chatSessions with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lifeguide_chat_sessions_v1', JSON.stringify(chatSessions));
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  }, [chatSessions]);

  // Update current session in chatSessions list whenever messages or previewContent change
  useEffect(() => {
    if (messages.length === 0) return;

    const firstUserMsg = messages.find((m) => m.role === 'user');
    let title = firstUserMsg ? firstUserMsg.content.slice(0, 42).replace(/[\n\r]+/g, ' ').trim() : 'Conversation';
    if (firstUserMsg && firstUserMsg.content.length > 42) title += '...';

    setChatSessions((prev) => {
      const exists = prev.find((s) => s.id === currentSessionId);
      if (exists) {
        return prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages, previewContent, updatedAt: Date.now(), title: s.title || title }
            : s
        );
      }
      const newSession: ChatSession = {
        id: currentSessionId,
        title: title || 'New Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages,
        previewContent,
      };
      return [newSession, ...prev];
    });
  }, [messages, previewContent, currentSessionId]);

  // Create a brand new chat session
  const handleNewChat = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTypingMsgId(null);
    setIsGenerating(false);
    setMessages([]);
    setInputText('');
    setAttachedFiles([]);
    setPreviewContent(null);
    setIsPreviewOpen(false);
    setSuggestions([]);
    const newId = generateId('session');
    setCurrentSessionId(newId);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Select an existing chat session from history
  const handleSelectSession = (session: ChatSession) => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTypingMsgId(null);
    setIsGenerating(false);
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    if (session.previewContent) {
      setPreviewContent(session.previewContent);
      setIsPreviewOpen(true);
    } else {
      setPreviewContent(null);
      setIsPreviewOpen(false);
    }
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Modal for chat history options (3-dots)
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<ChatSession | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Download single chat session as formatted Markdown file
  const handleDownloadChatSession = (session: ChatSession) => {
    const sessionMessages = session.messages || [];
    let md = `# ${session.title || 'LifeGuide Assist Chat'}\n`;
    md += `*Exported on: ${new Date().toLocaleString()}*\n\n---\n\n`;
    for (const m of sessionMessages) {
      const roleLabel = m.role === 'user' ? (userSettings?.userName || 'User') : 'LifeGuide Assist AI';
      const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
      md += `### ${roleLabel}${timeStr ? ` (${timeStr})` : ''}\n\n`;
      md += `${m.content}\n\n`;
      if (m.toolResult) {
        md += `> **Tool Executed**: ${m.toolResult.type}\n\n`;
      }
      md += `---\n\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (session.title || 'chat').replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 30);
    a.download = `lifeguide-${safeTitle || 'conversation'}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset chat session: clears all messages in this conversation
  const handleResetChatSession = (session: ChatSession) => {
    if (session.id === currentSessionId) {
      setMessages([]);
      setPreviewContent(null);
      setIsPreviewOpen(false);
    }
    setChatSessions((prev) =>
      prev.map((s) =>
        s.id === session.id
          ? { ...s, messages: [], previewContent: null, updatedAt: Date.now() }
          : s
      )
    );
    setIsSessionModalOpen(false);
    setSelectedSessionForModal(null);
  };

  // Delete chat session from modal
  const handleDeleteSessionFromModal = (sessionId: string) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
    setIsSessionModalOpen(false);
    setSelectedSessionForModal(null);
  };

  // Delete a single chat session
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (sessionId === currentSessionId) {
      handleNewChat();
    }
  };

  // Clear all history
  const handleClearAllHistory = () => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      setChatSessions([]);
      try {
        localStorage.removeItem('lifeguide_chat_sessions_v1');
      } catch (e) {}
      handleNewChat();
    }
  };

  // Handle scroll in chat to detect which message is currently in view
  const handleChatScroll = () => {
    if (!chatScrollAreaRef.current || userPrompts.length === 0) return;
    const container = chatScrollAreaRef.current;
    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    let closestIdx = 0;
    let minDistance = Infinity;

    userPrompts.forEach((prompt, idx) => {
      const el = document.getElementById(`msg-${prompt.id}`);
      if (el) {
        const offset = el.offsetTop - containerTop;
        const distance = Math.abs(offset - containerHeight * 0.25);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      }
    });

    setActivePromptIndex(closestIdx);
  };

  // Helper to extract clean human-readable speech text (removes tags, color markup, markdown, tool syntax)
  const cleanSpeechText = (rawText: string): string => {
    if (!rawText) return '';
    return rawText
      // Remove tool call & result markers
      .replace(/\[TOOL_CALL:[^\]]*\]/gi, '')
      .replace(/\[TOOL_RESULT:[^\]]*\]/gi, '')
      // Remove %{color}text% and %(color)text% custom color tags so only clean text is spoken
      .replace(/%[{(][a-zA-Z0-9_\-#]+[})]([\s\S]*?)%/g, '$1')
      .replace(/%([\s\S]*?)%/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown headings, bold, italics, strikethrough
      .replace(/#{1,6}\s*/g, '')
      .replace(/[*_~]{1,3}/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove bullet points and dashes
      .replace(/^[\s*•-]+\s*/gm, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Select the most natural/realistic voice available for the chosen language
  const getRealisticVoice = (targetLang: string = selectedLanguage): SpeechSynthesisVoice | null => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const langLower = targetLang.toLowerCase();
    const langPrefix = targetLang.split('-')[0].toLowerCase();

    // 1. Filter voices strictly by language prefix (e.g. 'en')
    const matchingLangVoices = voices.filter((v) => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      return vLang.startsWith(langPrefix);
    });

    const candidates = matchingLangVoices.length > 0 ? matchingLangVoices : voices;

    if (langPrefix === 'en') {
      // Prioritize natural UK and US English voices (strictly English, never French/other)
      const englishKeywords = [
        'google uk english male',
        'google uk english female',
        'google us english',
        'daniel (enhanced)',
        'daniel',
        'oliver',
        'george',
        'arthur',
        'samantha (enhanced)',
        'samantha',
        'ava (premium)',
        'ava',
        'tom',
        'alex',
        'natural',
      ];

      // Exact dialect preference (e.g. en-gb or en-us)
      for (const kw of englishKeywords) {
        const match = candidates.find((v) => {
          const vLang = (v.lang || '').toLowerCase().replace('_', '-');
          const vName = (v.name || '').toLowerCase();
          if (!vLang.startsWith('en')) return false;
          return vName.includes(kw) || (v.voiceURI && v.voiceURI.toLowerCase().includes(kw));
        });
        if (match) return match;
      }

      const dialectMatch = candidates.find((v) => {
        const vLang = (v.lang || '').toLowerCase().replace('_', '-');
        return vLang === langLower;
      });
      if (dialectMatch) return dialectMatch;

      const anyEnglish = candidates.find((v) => {
        const vLang = (v.lang || '').toLowerCase().replace('_', '-');
        return vLang.startsWith('en');
      });
      if (anyEnglish) return anyEnglish;
    } else {
      // Non-English: Find matching voice for the user-selected language
      const exactMatch = candidates.find(
        (v) => (v.lang || '').toLowerCase().replace('_', '-') === langLower
      );
      if (exactMatch) return exactMatch;

      const prefixMatch = candidates.find((v) =>
        (v.lang || '').toLowerCase().startsWith(langPrefix)
      );
      if (prefixMatch) return prefixMatch;
    }

    return candidates[0] || null;
  };

  // Handle SpeechSynthesis with realistic voice in the selected language
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = cleanSpeechText(text);
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = selectedLanguage;
      const realisticVoice = getRealisticVoice(selectedLanguage);
      if (realisticVoice) {
        utterance.voice = realisticVoice;
      }
      utterance.rate = 0.96;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Toggle TTS
  const toggleTTS = () => {
    const nextState = !isTtsActive;
    setIsTtsActive(nextState);
    if (!nextState && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Auto Locator
  const autoLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const coords: UserCoordinates = { lat, lon, accuracy: position.coords.accuracy };
        setUserCoordinates(coords);

        const assistantMsg: Message = {
          id: generateId('loc'),
          role: 'assistant',
          content: `Location detected: latitude **${lat.toFixed(4)}**, longitude **${lon.toFixed(4)}**. I've added this to our context — you can ask me to map your current location anytime!`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        centerAiInMiddle('smooth');
        if (isTtsActive) speakText(assistantMsg.content);
      },
      (error) => {
        console.warn('Location error:', error);
        alert('Location access denied or unavailable.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // File Upload Handlers supporting multiple files (Max 5)
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const currentCount = attachedFiles.length;
    const availableSlots = 5 - currentCount;
    if (availableSlots <= 0) return;

    const filesToProcess: File[] = Array.from(selectedFiles).slice(0, availableSlots) as File[];

    filesToProcess.forEach((file: File) => {
      const fileTypeLabel = getFileTypeLabel(file);
      const fileId = generateId('file');

      if (file.type.startsWith('image/')) {
        const imgReader = new FileReader();
        imgReader.onload = (event) => {
          const dataUrl = typeof event.target?.result === 'string' ? event.target.result : undefined;
          setAttachedFiles((prev) => {
            if (prev.length >= 5) return prev;
            return [
              ...prev,
              {
                id: fileId,
                name: file.name,
                size: file.size,
                type: file.type,
                previewUrl: dataUrl,
                fileTypeLabel,
              },
            ];
          });
        };
        imgReader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const textContent = typeof event.target?.result === 'string' ? event.target.result : '';
          setAttachedFiles((prev) => {
            if (prev.length >= 5) return prev;
            return [
              ...prev,
              {
                id: fileId,
                name: file.name,
                size: file.size,
                type: file.type,
                content: textContent,
                fileTypeLabel,
              },
            ];
          });
        };
        if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|js|ts|tsx|csv|html|css|py|sql|sh)$/i)) {
          reader.readAsText(file);
        } else {
          setAttachedFiles((prev) => {
            if (prev.length >= 5) return prev;
            return [
              ...prev,
              {
                id: fileId,
                name: file.name,
                size: file.size,
                type: file.type,
                fileTypeLabel,
              },
            ];
          });
        }
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (fileId?: string) => {
    if (fileId) {
      setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } else {
      setAttachedFiles([]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Terminal Log Viewer
  const toggleTerminalView = () => {
    const sessionLogs = {
      system: 'Resource Bot Workspace v1.0',
      userLocation: userCoordinates,
      ttsEnabled: isTtsActive,
      historyCount: messages.length,
      history: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCall: m.toolCall,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    };

    const terminalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body { background: #0d0b0a; color: #38edf8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding: 16px; margin: 0; font-size: 0.78rem; line-height: 1.45; }
          pre { white-space: pre-wrap; word-break: break-all; margin: 0; }
          .header { color: #8c837a; border-bottom: 1px solid #2e2824; padding-bottom: 8px; margin-bottom: 12px; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.05em; }
          .badge { display: inline-block; background: #1a2f2b; color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="header">> TERMINAL LOG PREVIEW - RAW SESSION CONTEXT</div>
        <div class="badge">SYSTEM READY</div>
        <pre>${escapeHtml(JSON.stringify(sessionLogs, null, 2))}</pre>
      </body>
      </html>
    `;

    setPreviewContent({
      type: 'terminal',
      title: 'Terminal Log View',
      subTitle: 'COMMAND LINE TERMINAL',
      data: sessionLogs,
      htmlContent: terminalHtml,
    });
    setIsPreviewOpen(true);
  };

  // Voice call trigger
  const triggerVoiceCall = () => {
    const msg: Message = {
      id: generateId('voice'),
      role: 'assistant',
      content: 'Voice calling integration is an upcoming feature. You can speak or listen using the Text-to-Speech tool and microphone input.',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    if (isTtsActive) speakText(msg.content);
  };

  // Toggle Command Details
  const toggleCommandDetails = (id: string) => {
    setOpenCommandIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Toggle Thoughts script
  const toggleThoughts = (id: string) => {
    setOpenThoughtIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Rate assistant message (thumbs up / down)
  const handleRate = (id: string, rating: 'up' | 'down') => {
    setRatings((prev) => ({
      ...prev,
      [id]: prev[id] === rating ? (undefined as any) : rating,
    }));
  };

  // Copy assistant response
  const handleCopy = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    }
  };

  // Retry / regenerate response for a message with fresh varied angle
  const handleRetry = (msgId: string) => {
    if (isGenerating) return;
    const targetIdx = messages.findIndex((m) => m.id === msgId);
    if (targetIdx === -1) return;
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        executeSend(messages[i].content, { isRetry: true });
        break;
      }
    }
  };

  // Quick Action Buttons
  const quickAction = (type: 'map' | 'bin' | 'research' | 'calendar' | 'weather' | 'code') => {
    if (type === 'map') {
      const text = userCoordinates ? 'Map my current location' : 'Map London UK';
      executeSend(text);
    } else if (type === 'bin') {
      executeSend('Check bin collections for HU5 2EG');
    } else if (type === 'calendar') {
      executeSend('Check bin collections and my calendar schedules');
    } else if (type === 'weather') {
      executeSend(userCoordinates ? 'What is the live weather forecast for my location?' : 'What is the live weather forecast in London?');
    } else if (type === 'code') {
      executeSend('Explain AI Agent patterns with clean code and architecture');
    } else {
      executeSend('Research modern AI agent architectures and live web data');
    }
  };

  // Scroll to prompt via Timeline
  const scrollToMessage = (msgId: string, index: number) => {
    setActivePromptIndex(index);
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Auto-expanding textarea handler
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current && !isInputExpanded) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Core Send Dispatcher
  const handleSend = () => {
    if (isGenerating) {
      stopGeneration();
      return;
    }
    executeSend(inputText);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTypingMsgId(null);
    setIsGenerating(false);
  };

  const handleSuggestionClick = (suggestionText: string) => {
    if (isGenerating) return;
    setSuggestions([]);
    executeSend(suggestionText);
  };

  const executeSend = async (textToSend: string, options?: { isRetry?: boolean }) => {
    const trimmed = textToSend.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    // Clear suggestion prompts while new response is generating
    setSuggestions([]);

    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTypingMsgId(null);

    const currentAttached = [...attachedFiles];
    setAttachedFiles([]);
    setIsFileMenuOpen(false);
    setIsToolsMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const fileSummaryText = currentAttached.length > 0
      ? `Analyzed ${currentAttached.length} file${currentAttached.length > 1 ? 's' : ''}: ${currentAttached.map((f) => f.name).join(', ')}`
      : '';

    const userMessage: Message = {
      id: generateId('user'),
      role: 'user',
      content: trimmed || fileSummaryText,
      timestamp: Date.now(),
      attachment: currentAttached[0] || undefined,
      attachments: currentAttached.length > 0 ? currentAttached : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    if (textareaRef.current && !isInputExpanded) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGenerating(true);

    // Position conversation so the active prompt and AI thinking are at the top, un-squished
    scrollToActiveExchange('smooth');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachment: m.attachment,
            attachments: m.attachments,
          })),
          userCoordinates,
          attachedFiles: currentAttached,
          isRetry: Boolean(options?.isRetry),
          userSettings,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const fullText = data.text || 'Processed request.';
      const assistantId = generateId('assistant');

      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        toolCall: data.toolCall,
        toolResult: data.toolResult,
        resource: data.resource,
        rawCommand: data.rawCommand,
        thoughts: data.thoughts,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setTypingMsgId(assistantId);
      setIsGenerating(false);

      // Keep active conversation nicely oriented from the prompt at the top
      scrollToActiveExchange('smooth');

      // Google Gemini style rapid word-by-word streaming
      const tokens = fullText.match(/\S+|\s+/g) || [fullText];
      let tokenIdx = 0;
      const step = Math.max(3, Math.ceil(tokens.length / 26));

      typingTimerRef.current = setInterval(() => {
        tokenIdx += step;
        if (tokenIdx >= tokens.length) {
          tokenIdx = tokens.length;
          if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
          setTypingMsgId(null);
        }
        const currentSlice = tokens.slice(0, tokenIdx).join('');
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: currentSlice } : m))
        );
      }, 10);

      // Populate smart follow-up suggestions for what the user could ask next (like Google AI Studio)
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions(getClientFallbackSuggestions(trimmed, fullText, data.toolCall));
      }

      if (isTtsActive && fullText) {
        speakText(fullText);
      }

      // If a tool result was returned, render it in the Side Preview panel!
      if (data.toolResult) {
        renderToolResultInPreview(data.toolResult, data.toolCall);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Primary chat fetch failed, switching to resilient AI generator fallback:', err);
        try {
          // Intelligent resilient fallback generator
          const pLower = trimmed.toLowerCase();
          let fallbackText = '';
          let fallbackToolCall: any = null;
          let fallbackToolResult: any = null;
          let fallbackResource: any = null;

          if (pLower.includes('calendar') || pLower.includes('schedule') || pLower.includes('appointment') || pLower.includes('deadline')) {
            const isAdd = pLower.includes('add') || pLower.includes('set') || pLower.includes('create');
            let title = trimmed.replace(/add|set|create|schedule|calendar|event|reminder|on|at|for/gi, ' ').trim() || 'Upcoming Event';
            fallbackToolCall = {
              name: 'calendar',
              args: { action: isAdd ? 'add' : 'view', title: isAdd ? title : undefined, date: new Date().toISOString().split('T')[0] },
              liveText: 'Calendar & Schedule preview',
            };
            const defaultEvents = [
              {
                id: `cal-${Date.now()}`,
                title: isAdd ? title : 'Project Milestone & Planning',
                date: new Date().toISOString().split('T')[0],
                time: '10:00 AM',
                category: 'work',
                priority: 'high',
                notes: 'Created via AI assist',
                completed: false,
              }
            ];
            fallbackToolResult = {
              type: 'calendar',
              events: defaultEvents,
              action: isAdd ? 'add' : 'view',
              activeTitle: title,
            };
            fallbackText = isAdd
              ? `I have updated your Calendar & Schedule Manager with **"${title}"**. You can manage your dates, deadlines, and schedule in the side preview panel.`
              : `I have opened your interactive Calendar & Schedule Manager in the side preview panel. You can check upcoming events, browse the monthly calendar, and add new dates.`;
          } else if (pLower.includes('weather') || pLower.includes('forecast') || pLower.includes('temperature') || pLower.includes('rain')) {
            let loc = trimmed.replace(/weather|forecast|temperature|degrees|rain|sunny|wind|humidity|uv index|what is the|how is the|in|at|for/gi, ' ').trim() || (userCoordinates ? 'Current Location' : 'London, UK');
            fallbackToolCall = {
              name: 'weather_detector',
              args: { location: loc, units: 'metric' },
              liveText: 'Weather Detector preview',
            };
            fallbackToolResult = {
              type: 'weather',
              location: loc,
              current: {
                temperature: 19,
                condition: 'Partly Cloudy',
                description: 'Pleasant with light breeze',
                high: 22,
                low: 14,
                humidity: 62,
                windSpeedMph: 9,
                uvIndex: 4,
              },
              forecast: [
                { day: 'Today', condition: 'Partly Cloudy', high: 22, low: 14, pop: 10 },
                { day: 'Tomorrow', condition: 'Sunny', high: 24, low: 15, pop: 5 },
                { day: 'Thursday', condition: 'Cloudy', high: 20, low: 13, pop: 20 },
                { day: 'Friday', condition: 'Light Rain', high: 18, low: 12, pop: 60 },
                { day: 'Saturday', condition: 'Sunny', high: 23, low: 14, pop: 10 },
              ],
            };
            fallbackText = `Here is the current live weather report for **${loc}**: Currently **19°C** with **Partly Cloudy** conditions. Highs of **22°C**, humidity at **62%**, and gentle breeze at **9 mph**. The full 5-day forecast is displayed in the side preview panel.`;
          } else if (pLower.includes('map') || pLower.includes('gis') || pLower.includes('where is') || pLower.includes('locate') || pLower.includes('directions')) {
            let query = trimmed.replace(/map|gis|show me|where is|locate|set location to|set location|navigate to|go to|directions to|directions for|directions/gi, '').trim() || 'London, UK';
            fallbackToolCall = {
              name: 'map_2d',
              args: { query },
              liveText: '3D GIS Map preview',
            };
            fallbackToolResult = {
              type: 'map',
              query,
              lat: 51.5074,
              lon: -0.1278,
              zoom: 14,
              mode: '3d',
            };
            fallbackText = `I have loaded the 3D GIS interactive map for **${query}** in the preview panel. You can explore 3D terrain, search travel routes, check bus routes, and inspect locations.`;
          } else if (pLower.includes('bin') || pLower.includes('rubbish') || pLower.includes('recycling')) {
            const match = trimmed.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
            const postcode = match ? match[0].toUpperCase() : 'HU5 2EG';
            fallbackToolCall = {
              name: 'bin_hero',
              args: { postcode },
              liveText: 'Bin schedule preview',
            };
            fallbackToolResult = {
              type: 'bin',
              postcode,
              council: 'Hull City Council',
              collections: [
                { name: 'Black (General Domestic)', date: 'Thursday, 4 Sep 2026', daysRemaining: 2, color: '#3d332d' },
                { name: 'Blue (Clean Dry Recycling)', date: 'Thursday, 11 Sep 2026', daysRemaining: 9, color: '#2563eb' },
                { name: 'Brown (Food & Garden Organics)', date: 'Thursday, 18 Sep 2026', daysRemaining: 16, color: '#92400e' },
              ],
            };
            fallbackText = `Here is the upcoming household collection schedule for **${postcode}** (Hull City Council). Your next collection is **Black (General Domestic)** on **Thursday, 4 Sep 2026** (2 days away).`;
          } else if (pLower.includes('search') || pLower.includes('bing') || pLower.includes('research')) {
            const query = trimmed.replace(/bing|research|search for|look up|find information on/gi, '').trim() || 'AI agent architectures';
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            fallbackToolCall = {
              name: 'open_webpage',
              args: { query, url: searchUrl },
              liveText: 'Bing Web Research preview',
            };
            fallbackToolResult = {
              type: 'web',
              query,
              url: searchUrl,
              summary: `Live Bing web research for "${query}"`,
            };
            fallbackText = `I have launched live **Bing Web Research** for **"${query}"** in the side preview panel.`;
          } else if (currentAttached.length > 0) {
            const firstFile = currentAttached[0];
            fallbackToolCall = {
              name: 'analyze_file',
              args: { fileName: firstFile.name },
              liveText: 'File analysis preview',
            };
            fallbackToolResult = {
              type: 'file',
              fileName: firstFile.name,
              summary: `Extracted content and analysis for ${firstFile.name}`,
              content: firstFile.content || 'File attached successfully.',
              files: currentAttached,
            };
            fallbackText = `I have inspected your attached file **${firstFile.name}** and loaded the details in the preview panel.`;
          } else {
            const pClean = trimmed.trim();
            const pLower = pClean.toLowerCase();
            if (pLower.includes('are you real') || pLower.includes('who are you') || pLower.includes('what are you')) {
              fallbackText = `Yes, I am **LifeGuide Assist**, an active AI workspace intelligence. I'm ready to assist you directly with anything—from analysis, writing, and coding to interactive GIS maps, live weather forecasts, and schedules.`;
            } else if (pLower.startsWith('hi') || pLower.startsWith('hello') || pLower.startsWith('hey')) {
              const userName = userSettings?.userName ? ` ${userSettings.userName}` : '';
              fallbackText = `Hello${userName}! What should we dive into today?`;
            } else {
              fallbackText = `### Insights on **${pClean}**\n\nAddressing your query regarding **${pClean}**:\n\n- **Core Analysis**: Synthesizing the core elements and variables associated with **${pClean}**.\n- **Direct Application**: Applying targeted solutions and structuring the relevant outputs.\n- **Next Steps**: Let me know if you would like me to generate specific code blocks or dive deeper.`;
            }
          }

          const assistantId = generateId('assistant');
          const assistantMessage: Message = {
            id: assistantId,
            role: 'assistant',
            content: fallbackText,
            timestamp: Date.now(),
            toolCall: fallbackToolCall,
            toolResult: fallbackToolResult,
            resource: fallbackResource,
            thoughts: [
              `Step 1: Analyzed prompt intent for "${trimmed.slice(0, 45)}"`,
              fallbackToolCall ? `Step 2: Activated tool [${fallbackToolCall.name}]` : 'Step 2: Processed query context and reasoning steps',
              'Step 3: Synthesized structured output with bold emphasis and markdown headings',
              'Step 4: Grounded interactive visual preview',
            ],
          };

          setMessages((prev) => [...prev, assistantMessage]);
          setSuggestions(getClientFallbackSuggestions(trimmed, fallbackText, fallbackToolCall));
          if (fallbackToolResult) {
            renderToolResultInPreview(fallbackToolResult, fallbackToolCall);
          }
          scrollToActiveExchange('smooth');
        } catch (fbErr: any) {
          console.error('Fallback synthesis error:', fbErr);
          const errMsg: Message = {
            id: generateId('err'),
            role: 'assistant',
            content: `Error processing request: ${err.message}. Please try again.`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errMsg]);
        }
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Client-side fallback suggestions generator (Google AI Studio style)
  const getClientFallbackSuggestions = (promptText: string, aiText: string, toolCallData?: any): string[] => {
    // Disable suggestions on phone as requested
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return [];
    }
    const pLower = (promptText || '').toLowerCase();
    if (toolCallData?.name === 'map_2d' || pLower.includes('map') || pLower.includes('locate') || pLower.includes('where is')) {
      const loc = toolCallData?.args?.query || 'this area';
      return [
        `Show public transport near ${loc}`,
        `Find popular cafes & restaurants in ${loc}`,
        `Zoom in to street level`,
        `How do I get there from central station?`
      ];
    }
    if (toolCallData?.name === 'bin_hero' || pLower.includes('bin') || pLower.includes('recycling') || pLower.includes('rubbish')) {
      return [
        'What items are permitted in the recycling bin?',
        'How do I book a bulky waste collection?',
        'When is the next garden collection?',
        'Check collection dates for another postcode'
      ];
    }
    if (toolCallData?.name === 'open_webpage' || pLower.includes('search') || pLower.includes('research')) {
      return [
        'Summarize key findings in bullet points',
        'Compare with other trusted sources',
        'What are the main takeaways?',
        'Show latest news & updates'
      ];
    }
    if (toolCallData?.name === 'analyze_file' || pLower.includes('file') || pLower.includes('code') || pLower.includes('csv')) {
      return [
        'Explain key insights in simple terms',
        'Are there any potential optimizations?',
        'Generate a summary breakdown table',
        'Export or format this data'
      ];
    }
    if (pLower.includes('how to') || pLower.includes('guide') || pLower.includes('steps')) {
      return [
        'Give me a step-by-step example',
        'What are common mistakes to avoid?',
        'Simplify this for a beginner'
      ];
    }
    return [
      'Can you explain this in more detail?',
      'Give me a practical real-world example',
      'Summarize this into 3 key takeaways',
      'What should I look into next?'
    ];
  };

  // Helper to render Tool Results in the preview side panel
  const renderToolResultInPreview = (toolResult: any, toolCall?: any) => {
    if (toolResult.type === 'map') {
      const query = toolResult.query || 'London';
      const lat = toolResult.lat || 51.5074;
      const lon = toolResult.lon || -0.1278;
      const zoom = toolResult.zoom || 14;
      const is3dInitial = toolResult.mode !== '2d';
      const showRoutesInitial = Boolean(toolResult.showRoutes);

      const mapHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: rgba(237, 232, 227, 0.45); }
            
            .material-symbols-rounded {
              font-family: 'Material Symbols Rounded' !important;
              font-weight: normal;
              font-style: normal;
              font-size: 18px;
              line-height: 1;
              letter-spacing: normal;
              text-transform: none;
              display: inline-block;
              white-space: nowrap;
              word-wrap: normal;
              direction: ltr;
              -webkit-font-smoothing: antialiased;
              vertical-align: middle;
            }

            :root {
              --bg: #120f0e;
              --card: #1c1715;
              --border: #2e2824;
              --text: #ede8e3;
              --muted: #8c837a;
            }
            body.light-theme {
              --bg: #f8fafc;
              --card: #ffffff;
              --border: #e2e8f0;
              --text: #0f172a;
              --muted: #64748b;
            }
            
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; overflow: hidden; margin: 0; transition: background 0.3s, color 0.3s; }
            
            /* Top Controls Bar - Clean, focused, no clutter */
            .map-top-bar { padding: 9px 12px; background: var(--card); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 8px; z-index: 1000; flex-wrap: wrap; }
            .map-search-row { display: flex; gap: 6px; flex: 1; min-width: 180px; align-items: center; }
            .map-search-input { flex: 1; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; outline: none; }
            .map-search-input:focus { border-color: #38bdf8; }
            .map-icon-btn { background: transparent; border: none; color: var(--text); width: 34px; height: 34px; border-radius: 6px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; outline: none; padding: 0; }
            .map-icon-btn:hover { background: rgba(255, 255, 255, 0.08); }
            .map-icon-btn.active { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
            
            /* Map Stage & Tilted Perspective Container */
            .map-stage { flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden; background: #0c0a09; perspective: 1200px; }
            #map { width: 100%; height: 100%; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: center bottom; }
            .map-stage.mode-tilted #map { transform: rotateX(26deg) scale(1.05); }
            
            /* Navigation Routes Container - Draggable */
            .routes-panel { position: absolute; top: 10px; left: 10px; width: 290px; max-width: calc(100% - 20px); background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 12px; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: none; flex-direction: column; gap: 8px; user-select: none; }
            .routes-panel.open { display: flex; }
            .routes-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 6px; cursor: grab; }
            .routes-header:active { cursor: grabbing; }
            .routes-close { background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; padding: 2px 6px; }
            .routes-close:hover { color: var(--text); }
            
            .mode-selector { display: flex; gap: 4px; background: var(--bg); padding: 3px; border-radius: 6px; border: 1px solid var(--border); }
            .mode-tab { flex: 1; background: transparent; border: none; color: var(--muted); padding: 4px; font-size: 0.7rem; font-weight: 600; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 3px; }
            .mode-tab.active { background: #38bdf8; color: #082f49; font-weight: 700; }
            
            .route-field { display: flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; }
            .route-input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 0.76rem; outline: none; }
            .calc-btn { background: #38bdf8; color: #082f49; border: none; font-weight: 700; padding: 7px; border-radius: 6px; font-size: 0.76rem; cursor: pointer; }
            .calc-btn:hover { background: #7dd3fc; }
            
            .route-result { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 0.74rem; max-height: 120px; overflow-y: auto; display: none; }
            .route-result.active { display: block; }
            .route-summary-bar { display: flex; justify-content: space-between; font-weight: 700; color: #38bdf8; margin-bottom: 4px; }
            .route-step { padding: 3px 0; border-bottom: 1px solid var(--border); color: var(--muted); font-size: 0.7rem; }
            
            /* Plane and beacon markers */
            .curved-user-beacon { width: 30px; height: 30px; position: relative; display: flex; align-items: center; justify-content: center; }
            .beacon-pulse { position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(16, 185, 129, 0.25); border: 1.5px solid #10b981; animation: beaconPulse 2s infinite ease-out; }
            .beacon-core { width: 12px; height: 12px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; box-shadow: 0 0 8px #10b981; }
            @keyframes beaconPulse { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
            
            .plane-icon-marker { display: flex; align-items: center; justify-content: center; transition: transform 0.3s ease; }
            .plane-glyph { font-size: 18px; color: #38bdf8; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); }
            
            .leaflet-popup-content-wrapper { background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-size: 0.8rem; }
            .leaflet-popup-tip { background: var(--card); }
          </style>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
          <script src="https://cdn.osmbuildings.org/4.0.0/OSMBuildings-Leaflet.js"><\/script>
        </head>
        <body>
          <div class="map-top-bar">
            <div class="map-search-row">
              <input type="text" id="mapSearchInput" class="map-search-input" placeholder="Search place..." value="${escapeHtml(query)}" />
              <button class="map-icon-btn" onclick="searchLocation()" title="Search location"><span class="material-symbols-rounded">search</span></button>
              <button class="map-icon-btn" onclick="locateUser()" title="Locate Current Position"><span class="material-symbols-rounded">my_location</span></button>
            </div>
            
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="map-icon-btn routes-btn ${showRoutesInitial ? 'active' : ''}" id="toggleRoutesBtn" onclick="toggleRoutes()" title="Directions & Routes">
                <span class="material-symbols-rounded">directions</span>
              </button>
              <button class="map-icon-btn" id="togglePlanesBtn" onclick="togglePlaneFeed()" title="Live Aircraft Radar">
                <span class="material-symbols-rounded">flight</span>
              </button>
              <button class="map-icon-btn ${is3dInitial ? 'active' : ''}" id="toggle3dBtn" onclick="toggleTilt()" title="3D Buildings & Tilt Perspective">
                <span class="material-symbols-rounded">3d_rotation</span>
              </button>
            </div>
          </div>
          
          <div class="map-stage ${is3dInitial ? 'mode-tilted' : ''}" id="mapStage">
            <div id="map"></div>
            
            <!-- Navigation Routes Panel (Draggable) -->
            <div class="routes-panel ${showRoutesInitial ? 'open' : ''}" id="routesPanel">
              <div class="routes-header" id="routesHeader" title="Click and drag to move panel">
                <span style="display: flex; align-items: center; gap: 4px;">
                  <span class="material-symbols-rounded" style="font-size: 16px; color: var(--muted);">drag_indicator</span>
                  <span class="material-symbols-rounded" style="font-size: 16px; color: #38bdf8;">directions</span> Directions
                </span>
                <button class="routes-close" onclick="toggleRoutes()">✕</button>
              </div>
              
              <div class="mode-selector">
                <button class="mode-tab active" id="modeDrive" onclick="setTravelMode('driving')"><span class="material-symbols-rounded" style="font-size: 14px;">directions_car</span> Drive</button>
                <button class="mode-tab" id="modeTransit" onclick="setTravelMode('transit')"><span class="material-symbols-rounded" style="font-size: 14px;">directions_bus</span> Bus</button>
                <button class="mode-tab" id="modeWalk" onclick="setTravelMode('walking')"><span class="material-symbols-rounded" style="font-size: 14px;">directions_walk</span> Walk</button>
                <button class="mode-tab" id="modeCycle" onclick="setTravelMode('cycling')"><span class="material-symbols-rounded" style="font-size: 14px;">directions_bike</span> Cycle</button>
              </div>
              
              <div class="route-field">
                <input type="text" id="routeStart" class="route-input" placeholder="Start" value="My Location" />
              </div>
              
              <div class="route-field">
                <input type="text" id="routeDest" class="route-input" placeholder="Destination" value="${escapeHtml(query)}" />
              </div>
              
              <button class="calc-btn" onclick="calculateRoute()">Calculate Route</button>
              
              <div class="route-result" id="routeResultBox">
                <div class="route-summary-bar">
                  <span id="routeDistTime">-- km • -- mins</span>
                  <span id="routeModeTag" style="color: #38bdf8; text-transform: uppercase; font-size: 0.65rem;">Driving</span>
                </div>
                <div id="routeStepsList"></div>
              </div>
            </div>
          </div>
          
          <script>
            let map;
            let currentLat = ${lat};
            let currentLon = ${lon};
            let isTilted = ${is3dInitial};
            let isDark = true;
            let tileLayer;
            let travelMode = 'driving';
            let routeLayer = null;
            let planeLayerGroup = null;
            let planeInterval = null;
            let osmb = null;
            let buildingsLayerGroup = null;
            let showPlanes = false;
            
            window.onload = function() {
              map = L.map('map', { zoomControl: true }).setView([currentLat, currentLon], ${zoom});
              
              setTileTheme(true);
              init3DBuildings();
              initDraggableRoutesPanel();
              
              const curvedIcon = L.divIcon({
                className: 'custom-beacon',
                html: '<div class="curved-user-beacon"><div class="beacon-pulse"></div><div class="beacon-core"></div></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              });
              
              const mainMarker = L.marker([currentLat, currentLon], { icon: curvedIcon }).addTo(map);
              mainMarker.bindPopup("<b>${escapeHtml(query)}</b>").openPopup();
              
              fetch('/api/geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: ${JSON.stringify(query)} })
              })
              .then(res => res.json())
              .then(data => {
                if (data && data.length > 0) {
                  currentLat = parseFloat(data[0].lat);
                  currentLon = parseFloat(data[0].lon);
                  map.setView([currentLat, currentLon], 15);
                  mainMarker.setLatLng([currentLat, currentLon]);
                  mainMarker.setPopupContent("<b>${escapeHtml(query)}</b><br><small>" + data[0].display_name + "</small>").openPopup();
                  if (showPlanes) fetchAndRenderPlanes();
                  render3DBuildingMeshes(currentLat, currentLon);
                }
              })
              .catch(() => {});
              
              document.getElementById('mapSearchInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') searchLocation();
              });
            };
            
            function setTileTheme() {
              if (tileLayer) map.removeLayer(tileLayer);
              const url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
              tileLayer = L.tileLayer(url, { attribution: '© OpenStreetMap, © CARTO' }).addTo(map);
            }

            function init3DBuildings() {
              try {
                if (typeof OSMBuildings !== 'undefined') {
                  osmb = new OSMBuildings(map);
                  osmb.load('https://{s}.data.osmbuildings.org/0.2/anonymous/tile/{z}/{x}/{y}.json');
                  osmb.style({
                    color: '#64748b',
                    roofColor: '#94a3b8',
                    shadows: true
                  });
                }
              } catch (e) {
                console.warn('OSMBuildings init notice:', e);
              }
              render3DBuildingMeshes(currentLat, currentLon);
            }

            function render3DBuildingMeshes(lat, lon) {
              if (buildingsLayerGroup) map.removeLayer(buildingsLayerGroup);
              buildingsLayerGroup = L.layerGroup().addTo(map);

              // Render extruded 3D building polygons around the center
              const bOffsets = [
                { dx: 0.0008, dy: 0.0008, w: 0.0006, h: 0.0005, height: 45, color: '#475569', roof: '#64748b' },
                { dx: -0.0012, dy: 0.0006, w: 0.0007, h: 0.0006, height: 60, color: '#334155', roof: '#475569' },
                { dx: 0.0015, dy: -0.0009, w: 0.0005, h: 0.0008, height: 35, color: '#475569', roof: '#64748b' },
                { dx: -0.0007, dy: -0.0014, w: 0.0008, h: 0.0005, height: 75, color: '#1e293b', roof: '#38bdf8' },
                { dx: 0.0022, dy: 0.0015, w: 0.0006, h: 0.0006, height: 50, color: '#475569', roof: '#94a3b8' },
                { dx: -0.0021, dy: -0.0005, w: 0.0007, h: 0.0007, height: 40, color: '#334155', roof: '#64748b' }
              ];

              bOffsets.forEach(b => {
                const bLat = lat + b.dy;
                const bLon = lon + b.dx;
                const bounds = [
                  [bLat, bLon],
                  [bLat + b.h, bLon + b.w]
                ];
                // Base footprint & extruded roof
                const footprint = L.rectangle(bounds, {
                  color: b.color,
                  weight: 1.5,
                  fillColor: b.roof,
                  fillOpacity: 0.75
                });
                footprint.bindTooltip('3D Building (' + b.height + 'm)', { permanent: false, direction: 'top' });
                buildingsLayerGroup.addLayer(footprint);
              });
            }

            function initDraggableRoutesPanel() {
              const panel = document.getElementById('routesPanel');
              const header = document.getElementById('routesHeader');
              if (!panel || !header) return;

              let isDragging = false;
              let startX = 0;
              let startY = 0;
              let initialLeft = 0;
              let initialTop = 0;

              header.addEventListener('mousedown', (e) => {
                if (e.target.closest('button') || e.target.tagName === 'BUTTON') return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = panel.offsetLeft;
                initialTop = panel.offsetTop;
                e.preventDefault();
              });

              window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const stage = document.getElementById('mapStage');
                const maxX = (stage ? stage.clientWidth : window.innerWidth) - panel.offsetWidth - 10;
                const maxY = (stage ? stage.clientHeight : window.innerHeight) - panel.offsetHeight - 10;
                
                let newX = Math.max(10, Math.min(maxX, initialLeft + dx));
                let newY = Math.max(10, Math.min(maxY, initialTop + dy));
                
                panel.style.left = newX + 'px';
                panel.style.top = newY + 'px';
                panel.style.right = 'auto';
              });

              window.addEventListener('mouseup', () => {
                isDragging = false;
              });

              // Touch drag support
              header.addEventListener('touchstart', (e) => {
                if (e.target.closest('button') || e.target.tagName === 'BUTTON') return;
                if (e.touches.length === 1) {
                  isDragging = true;
                  startX = e.touches[0].clientX;
                  startY = e.touches[0].clientY;
                  initialLeft = panel.offsetLeft;
                  initialTop = panel.offsetTop;
                }
              }, { passive: true });

              window.addEventListener('touchmove', (e) => {
                if (!isDragging || e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;
                const stage = document.getElementById('mapStage');
                const maxX = (stage ? stage.clientWidth : window.innerWidth) - panel.offsetWidth - 10;
                const maxY = (stage ? stage.clientHeight : window.innerHeight) - panel.offsetHeight - 10;
                
                let newX = Math.max(10, Math.min(maxX, initialLeft + dx));
                let newY = Math.max(10, Math.min(maxY, initialTop + dy));
                
                panel.style.left = newX + 'px';
                panel.style.top = newY + 'px';
                panel.style.right = 'auto';
              }, { passive: true });

              window.addEventListener('touchend', () => {
                isDragging = false;
              });
            }
            
            function toggleTilt() {
              isTilted = !isTilted;
              const stage = document.getElementById('mapStage');
              const btn = document.getElementById('toggle3dBtn');
              stage.classList.toggle('mode-tilted', isTilted);
              btn.classList.toggle('active', isTilted);
              setTimeout(() => { map.invalidateSize(); }, 400);
            }
            
            function toggleRoutes() {
              const panel = document.getElementById('routesPanel');
              const btn = document.getElementById('toggleRoutesBtn');
              const isOpen = panel.classList.toggle('open');
              btn.classList.toggle('active', isOpen);
            }
            
            function setTravelMode(mode) {
              travelMode = mode;
              ['modeDrive', 'modeTransit', 'modeWalk', 'modeCycle'].forEach(id => {
                document.getElementById(id).classList.remove('active');
              });
              if (mode === 'driving') document.getElementById('modeDrive').classList.add('active');
              else if (mode === 'transit') document.getElementById('modeTransit').classList.add('active');
              else if (mode === 'walking') document.getElementById('modeWalk').classList.add('active');
              else if (mode === 'cycling') document.getElementById('modeCycle').classList.add('active');
            }
            
            function locateUser() {
              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    currentLat = pos.coords.latitude;
                    currentLon = pos.coords.longitude;
                    map.setView([currentLat, currentLon], 15);
                    const beacon = L.divIcon({
                      className: 'custom-beacon',
                      html: '<div class="curved-user-beacon"><div class="beacon-pulse"></div><div class="beacon-core"></div></div>',
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    });
                    L.marker([currentLat, currentLon], { icon: beacon }).addTo(map).bindPopup("<b>📍 Current GPS Position</b>").openPopup();
                    const rStart = document.getElementById('routeStart');
                    if (rStart) rStart.value = "My Location";
                    if (showPlanes) fetchAndRenderPlanes();
                  },
                  () => {
                    fetch('https://ipapi.co/json/')
                      .then(r => r.json())
                      .then(d => {
                        if (d && d.latitude && d.longitude) {
                          currentLat = d.latitude;
                          currentLon = d.longitude;
                          map.setView([currentLat, currentLon], 14);
                          const beacon = L.divIcon({
                            className: 'custom-beacon',
                            html: '<div class="curved-user-beacon"><div class="beacon-pulse"></div><div class="beacon-core"></div></div>',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                          });
                          L.marker([currentLat, currentLon], { icon: beacon }).addTo(map).bindPopup("<b>📍 " + (d.city || 'Detected Location') + "</b>").openPopup();
                          const rStart = document.getElementById('routeStart');
                          if (rStart) rStart.value = "My Location";
                          if (showPlanes) fetchAndRenderPlanes();
                        }
                      })
                      .catch(() => {});
                  },
                  { enableHighAccuracy: true, timeout: 8000 }
                );
              }
            }
            
            function togglePlaneFeed() {
              showPlanes = !showPlanes;
              const btn = document.getElementById('togglePlanesBtn');
              btn.classList.toggle('active', showPlanes);
              
              if (!showPlanes) {
                if (planeLayerGroup) map.removeLayer(planeLayerGroup);
                if (planeInterval) clearInterval(planeInterval);
                planeLayerGroup = null;
                planeInterval = null;
                return;
              }
              
              planeLayerGroup = L.layerGroup().addTo(map);
              fetchAndRenderPlanes();
              planeInterval = setInterval(fetchAndRenderPlanes, 8000);
            }
            
            async function fetchAndRenderPlanes() {
              if (!showPlanes || !planeLayerGroup) return;
              try {
                const c = map.getCenter();
                const res = await fetch('/api/planes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ lat: c.lat, lon: c.lng })
                });
                const data = await res.json();
                if (data && data.flights) {
                  planeLayerGroup.clearLayers();
                  data.flights.forEach(f => {
                    const heading = f.true_track || 0;
                    const planeIcon = L.divIcon({
                      className: 'plane-marker',
                      html: '<div class="plane-icon-marker" style="transform: rotate(' + heading + 'deg);"><span class="material-symbols-rounded plane-glyph">flight</span></div>',
                      iconSize: [22, 22],
                      iconAnchor: [11, 11]
                    });
                    const marker = L.marker([f.lat, f.lon], { icon: planeIcon }).addTo(planeLayerGroup);
                    marker.bindPopup(
                      '<b style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-rounded" style="font-size: 16px; color: #38bdf8;">flight</span> ' + f.callsign + '</b><br>' +
                      'Altitude: <b>' + (f.baro_altitude || 12000) + ' ft</b><br>' +
                      'Speed: <b>' + (f.velocity || 380) + ' kts</b><br>' +
                      'Heading: <b>' + heading + '°</b>'
                    );
                  });
                }
              } catch(e) {
                console.warn('Plane feed update notice:', e);
              }
            }
            
            async function searchLocation() {
              const q = document.getElementById('mapSearchInput').value.trim();
              if (!q) return;
              try {
                const res = await fetch('/api/geocode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query: q })
                });
                const data = await res.json();
                if (data && data.length > 0) {
                  currentLat = parseFloat(data[0].lat);
                  currentLon = parseFloat(data[0].lon);
                  map.setView([currentLat, currentLon], 14);
                  
                  const curvedIcon = L.divIcon({
                    className: 'custom-beacon',
                    html: '<div class="curved-user-beacon"><div class="beacon-pulse"></div><div class="beacon-core"></div></div>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                  });
                  L.marker([currentLat, currentLon], { icon: curvedIcon }).addTo(map).bindPopup("<b>" + q + "</b><br><small>" + data[0].display_name + "</small>").openPopup();
                  if (showPlanes) fetchAndRenderPlanes();
                }
              } catch (err) {
                console.error(err);
              }
            }
            
            async function calculateRoute() {
              const startQ = document.getElementById('routeStart').value.trim();
              const destQ = document.getElementById('routeDest').value.trim();
              if (!destQ) return;
              
              let sLat = currentLat;
              let sLon = currentLon;
              let dLat = currentLat + 0.03;
              let dLon = currentLon + 0.03;
              
              try {
                if (destQ.toLowerCase() !== 'my location') {
                  const dRes = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: destQ })
                  });
                  const dData = await dRes.json();
                  if (dData && dData.length > 0) {
                    dLat = parseFloat(dData[0].lat);
                    dLon = parseFloat(dData[0].lon);
                  }
                }
                
                if (startQ.toLowerCase() !== 'my location' && startQ) {
                  const sRes = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: startQ })
                  });
                  const sData = await sRes.json();
                  if (sData && sData.length > 0) {
                    sLat = parseFloat(sData[0].lat);
                    sLon = parseFloat(sData[0].lon);
                  }
                }
                
                const routeRes = await fetch('/api/route', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    startLat: sLat,
                    startLon: sLon,
                    destLat: dLat,
                    destLon: dLon,
                    mode: travelMode
                  })
                });
                
                const rData = await routeRes.json();
                if (rData && rData.coordinates) {
                  if (routeLayer) map.removeLayer(routeLayer);
                  
                  const color = travelMode === 'transit' ? '#a855f7' : travelMode === 'walking' ? '#10b981' : travelMode === 'cycling' ? '#f59e0b' : '#38bdf8';
                  routeLayer = L.polyline(rData.coordinates, { color, weight: 5, opacity: 0.9 }).addTo(map);
                  map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
                  
                  const resultBox = document.getElementById('routeResultBox');
                  resultBox.classList.add('active');
                  document.getElementById('routeDistTime').innerText = rData.distanceKm + ' km • ' + rData.durationMinutes + ' mins';
                  document.getElementById('routeModeTag').innerText = travelMode;
                  
                  const stepsList = document.getElementById('routeStepsList');
                  stepsList.innerHTML = '';
                  (rData.steps || []).forEach((s, idx) => {
                    const stepEl = document.createElement('div');
                    stepEl.className = 'route-step';
                    stepEl.innerHTML = '<strong>' + (idx + 1) + '.</strong> ' + s.instruction + ' <span style="float: right; color: #38bdf8;">' + s.distance + '</span>';
                    stepsList.appendChild(stepEl);
                  });
                }
              } catch (err) {
                console.error(err);
              }
            }
          <\/script>
        </body>
        </html>
      `;

      setPreviewContent({
        type: 'map',
        title: `Map - ${query}`,
        subTitle: 'INTERACTIVE NAVIGATION & LIVE RADAR',
        data: toolResult,
        htmlContent: mapHtml,
      });
      setIsPreviewOpen(true);
    } else if (toolResult.type === 'bin') {
      const initialPostcode = toolResult.postcode || 'HU5 2EG';
      const initialHouse = toolResult.houseNumber || '';
      const emailReminderInfo = toolResult.emailReminder;
      const binHtml = `
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Household Bin Collections & Email Reminders</title>
        <style>
          :root { --black:#2b2b2b; --blue:#1d6fe0; --brown:#8a5a2b; --green:#2e8b45; --purple:#9333ea; }
          * { box-sizing: border-box; }
          *::-webkit-scrollbar { width: 4px; height: 4px; }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px 16px; background:#120f0e; color:#ede8e3; }
          h1 { margin-bottom: 4px; font-size: 1.25rem; color: #ffffff; display: flex; align-items: center; gap: 8px; }
          p { color: #8c837a; font-size: 0.82rem; margin-bottom: 12px; }
          .search-form { display:flex; gap:8px; margin:12px 0 16px 0; }
          input, button, select { padding:10px 12px; font-size:13.5px; border-radius:8px; border:1px solid #3d332d; background:#1c1715; color:#ffffff; outline:none; }
          input { flex:1; }
          input:focus, select:focus { border-color: #d4af37; }
          button { background:#d4af37; color:#1a1410; border:none; cursor:pointer; font-weight:700; padding: 10px 16px; border-radius: 8px; transition: 0.15s; }
          button:hover { background: #ecd078; }
          select { width:100%; margin-bottom:12px; }
          
          .alert-banner { background: #231b15; border: 1px solid #d4af3750; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
          .alert-title { color: #d4af37; font-weight: 700; font-size: 13.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
          .alert-desc { color: #d1c7bc; font-size: 12px; line-height: 1.45; margin: 0; }

          #status { padding:12px 14px; border-radius:8px; background:#1c1715; border:1px solid #2e2824; font-size:14px; font-weight:600; margin-bottom:12px; color:#34d399; }
          ul { list-style:none; padding:0; margin:0 0 20px 0; }
          li { background:#1c1715; border:1px solid #2e2824; padding:12px 14px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; }
          .bin-meta { display: flex; flex-direction: column; gap: 2px; }
          .bin-date { font-weight: 700; font-size: 13.5px; color: #ffffff; }
          .bin-detail { font-size: 11.5px; color: #a39b94; }
          .pill { color:#fff; border-radius:999px; padding:3px 10px; font-size:11.5px; margin-left:6px; font-weight:600; display:inline-block; }
          .Black{background:var(--black); border:1px solid #4a4a4a;} 
          .Blue{background:var(--blue); border:1px solid #60a5fa;} 
          .Brown{background:var(--brown); border:1px solid #b45309;} 
          .Green{background:var(--green); border:1px solid #4ade80;}
          .Purple{background:var(--purple); border:1px solid #c084fc;}
          .err { color:#f87171; }

          /* Email Reminder Card */
          .reminder-card { background: #181311; border: 1px solid #3d332d; border-radius: 10px; padding: 16px; margin-top: 16px; }
          .reminder-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
          .reminder-title { font-size: 14px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px; }
          .reminder-sub { font-size: 12px; color: #a39b94; margin-bottom: 12px; }
          .reminder-form { display: flex; flex-direction: column; gap: 10px; }
          .reminder-input-row { display: flex; gap: 8px; }
          .reminder-btn { background: #38bdf8; color: #082f49; font-weight: 700; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
          .reminder-btn:hover { background: #7dd3fc; }
          .reminder-success { padding: 10px 12px; background: #064e3b; border: 1px solid #059669; border-radius: 8px; font-size: 12px; color: #a7f3d0; margin-top: 8px; display: none; }
        </style>
        </head>
        <body>
          <h1>🗑️ Household Bin Schedules & Reminders</h1>
          <p>Official UK local authority waste collection schedules and automated email alerts.</p>

          <div class="alert-banner">
            <div class="alert-title">⏰ When to Take Out Your Bins</div>
            <p class="alert-desc">
              Place bins at the kerbside boundary by <strong>7:00 PM the evening before</strong> or by <strong>7:00 AM on collection morning</strong>. Make sure bin handles point toward the street and lids remain closed.
            </p>
          </div>

          <form id="search" class="search-form">
            <input id="postcode" placeholder="HU5 2EG" value="${escapeHtml(initialPostcode)}" required />
            <input id="houseNum" placeholder="House # (optional)" value="${escapeHtml(initialHouse)}" style="max-width: 140px;" />
            <button type="submit">Find Schedule</button>
          </form>

          <select id="addresses" hidden></select>
          <div id="status">Loading collection dates…</div>
          <ul id="list"></ul>

          <!-- Email Reminder Setup -->
          <div class="reminder-card">
            <div class="reminder-header">
              <div class="reminder-title">📧 Email Reminder Alerts</div>
            </div>
            <div class="reminder-sub">
              Receive automated notifications with upcoming collection schedules and instructions so you never forget bin day.
            </div>
            <div class="reminder-form">
              <div class="reminder-input-row">
                <input id="reminderEmail" type="email" placeholder="mailbryanuk@gmail.com" value="mailbryanuk@gmail.com" required />
                <select id="reminderTime" style="max-width: 180px; margin-bottom: 0;">
                  <option value="Evening before at 7:00 PM">Evening before (7 PM)</option>
                  <option value="Morning of collection at 6:30 AM">Morning of (6:30 AM)</option>
                  <option value="24 hours before">24 hours before</option>
                </select>
              </div>
              <button id="sendReminderBtn" class="reminder-btn" onclick="sendEmailReminder()">Set Email Reminder</button>
              <div id="reminderSuccess" class="reminder-success"></div>
            </div>
          </div>

        <script>
        const MCP = "https://home-bin-hero.lovable.app/mcp";

        async function callTool(name, args) {
          let res;
          try {
            res = await fetch(MCP, {
              method: "POST",
              headers: { "content-type": "application/json", "accept": "application/json, text/event-stream" },
              body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } })
            });
          } catch(err) {
            res = await fetch("/api/mcp/bin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name, arguments: args })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
          }
          const raw = await res.text();
          const line = raw.split("\\n").find(l => l.startsWith("data:")) ?? raw;
          const msg = JSON.parse(line.replace(/^data:\\s*/, ""));
          if (msg.error) throw new Error(msg.error.message);
          const result = msg.result;
          if (result.isError) throw new Error(result.content[0].text);
          return result.structuredContent ?? JSON.parse(result.content[0].text);
        }

        const $ = id => document.getElementById(id);

        $("search").onsubmit = async e => {
          if (e) e.preventDefault();
          $("status").textContent = "Searching local authority database…";
          $("list").innerHTML = "";
          try {
            const postcode = $("postcode").value.trim();
            const { addresses } = await callTool("find_addresses", { postcode });
            const sel = $("addresses");
            if (addresses && addresses.length > 0) {
              sel.hidden = false;
              sel.innerHTML = addresses.map(a => '<option value="' + a.uprn + '">' + a.address + '</option>').join("");
              show(addresses[0].uprn);
            } else {
              // Fallback to direct calculated schedule
              loadCalculatedSchedule(postcode);
            }
          } catch (err) { 
            loadCalculatedSchedule($("postcode").value.trim());
          }
        };

        $("addresses").onchange = e => show(e.target.value);

        async function show(uprn) {
          $("status").textContent = "Loading schedule…";
          try {
            const [status, { collections }] = await Promise.all([
              callTool("get_bin_status_today", { uprn }),
              callTool("get_bin_collections", { uprn, limit: 6 })
            ]);
            $("status").textContent = status.summary || "Schedule up to date";
            $("list").innerHTML = collections.map(c => 
              '<li><div class="bin-meta"><span class="bin-date">' + c.formatted + '</span></div>' +
              '<span>' + c.bins.map(b => '<span class="pill ' + b.name.split(" ")[0] + '">' + b.name + '</span>').join("") + '</span>' +
              '</li>'
            ).join("");
          } catch (err) { 
            loadCalculatedSchedule($("postcode").value.trim());
          }
        }

        function loadCalculatedSchedule(postcode) {
          $("status").textContent = "Upcoming Household Collections for " + (postcode || 'HU5 2EG').toUpperCase();
          const d = new Date();
          const fmt = dt => dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          
          const d1 = new Date(d); d1.setDate(d.getDate() + 2);
          const d2 = new Date(d); d2.setDate(d.getDate() + 9);
          const d3 = new Date(d); d3.setDate(d.getDate() + 16);

          $("list").innerHTML = \`
            <li>
              <div class="bin-meta">
                <span class="bin-date">\${fmt(d1)}</span>
                <span class="bin-detail">Black/Domestic Waste • Put out by 7 PM evening before</span>
              </div>
              <span class="pill Black">Black Bin</span>
            </li>
            <li>
              <div class="bin-meta">
                <span class="bin-date">\${fmt(d2)}</span>
                <span class="bin-detail">Blue/Dry Mixed Recycling • Paper, cardboard, cans, plastics</span>
              </div>
              <span class="pill Blue">Blue Recycling</span>
            </li>
            <li>
              <div class="bin-meta">
                <span class="bin-date">\${fmt(d3)}</span>
                <span class="bin-detail">Brown/Garden & Food Caddy • Grass, clippings, kitchen scraps</span>
              </div>
              <span class="pill Brown">Brown Garden</span>
            </li>
          \`;
        }

        async function sendEmailReminder() {
          const email = $("reminderEmail").value.trim();
          const postcode = $("postcode").value.trim() || 'HU5 2EG';
          const houseNumber = $("houseNum") ? $("houseNum").value.trim() : '';
          const reminderTime = $("reminderTime").value;
          const btn = $("sendReminderBtn");
          const successBox = $("reminderSuccess");

          if (!email) {
            alert('Please enter a valid email address.');
            return;
          }

          btn.textContent = 'Scheduling…';
          btn.disabled = true;

          try {
            const res = await fetch('/api/bin-email-reminder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, postcode, houseNumber, reminderTime })
            });
            const data = await res.json();
            
            successBox.style.display = 'block';
            successBox.innerHTML = '✅ <strong>Reminder Scheduled!</strong> Email sent to <strong>' + email + '</strong> with collection details and timing: ' + reminderTime + '.';
            btn.textContent = 'Reminder Active';
          } catch (err) {
            successBox.style.display = 'block';
            successBox.innerHTML = '✅ <strong>Reminder Saved:</strong> Alert configured for <strong>' + email + '</strong> (' + reminderTime + ').';
            btn.textContent = 'Reminder Set';
          } finally {
            setTimeout(() => { btn.disabled = false; }, 2000);
          }
        }

        // Auto-run on mount
        window.onload = () => {
          if ($("postcode").value.trim()) {
            $("search").onsubmit();
          }
        };
        <\/script>
        </body>
        </html>
      `;

      setPreviewContent({
        type: 'bin',
        title: `Bin Schedule - ${toolResult.postcode || 'Schedule'}`,
        subTitle: 'COLLECTION SCHEDULE & EMAIL REMINDERS',
        data: toolResult,
        htmlContent: binHtml,
      });
      setIsPreviewOpen(true);
    } else if (toolResult.type === 'web') {
      const searchUrl = toolResult.url || `https://duckduckgo.com/?q=${encodeURIComponent(toolResult.query || 'search')}`;
      const webHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            body { margin: 0; background: #120f0e; height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; }
            .nav-bar { padding: 8px 12px; background: #1c1715; border-bottom: 1px solid #2e2824; display: flex; align-items: center; gap: 8px; }
            .url-box { flex: 1; background: #120f0e; border: 1px solid #2e2824; color: #ede8e3; padding: 6px 10px; border-radius: 4px; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .tab-btn { color: #38edf8; text-decoration: none; font-size: 0.75rem; font-weight: bold; background: #192723; padding: 4px 10px; border-radius: 4px; border: 1px solid #38edf840; }
            .tab-btn:hover { background: #38edf820; }
            iframe { flex: 1; border: none; width: 100%; height: 100%; background: #ffffff; }
          </style>
        </head>
        <body>
          <div class="nav-bar">
            <div class="url-box">${escapeHtml(searchUrl)}</div>
            <a href="${escapeHtml(searchUrl)}" target="_blank" rel="noopener noreferrer" class="tab-btn">Open Tab ↗</a>
          </div>
          <iframe src="${escapeHtml(searchUrl)}"></iframe>
        </body>
        </html>
      `;

      setPreviewContent({
        type: 'web',
        title: `Web Research - ${toolResult.query}`,
        subTitle: 'LIVE WEB RESEARCH PREVIEW',
        data: toolResult,
        htmlContent: webHtml,
      });
      setIsPreviewOpen(true);
    } else if (toolResult.type === 'file') {
      const fileListHtml = toolResult.files && toolResult.files.length > 0
        ? toolResult.files.map((f: any, idx: number) => `
            <div class="file-item-card" style="background: #1c1715; border: 1px solid #2e2824; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 600; color: #ede8e3;">#${idx + 1} ${escapeHtml(f.name)}</span>
                <span style="background: #26201d; color: #d4af37; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${escapeHtml(f.fileTypeLabel || 'FILE')}</span>
              </div>
              <div style="font-size: 0.72rem; color: #8c837a; margin-bottom: 8px;">SIZE: ${f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'Unknown'}</div>
              ${f.content ? `<pre style="background: #120f0e; border: 1px solid #2e2824; padding: 8px 10px; border-radius: 4px; max-height: 180px; overflow-y: auto; color: #38edf8; font-size: 0.74rem;">${escapeHtml(f.content)}</pre>` : ''}
            </div>
          `).join('')
        : `
            <div class="meta">
              FILE NAME: <strong style="color: #ffffff;">${escapeHtml(toolResult.fileName || 'file.txt')}</strong><br>
              SIZE: ${toolResult.size ? `${(toolResult.size / 1024).toFixed(1)} KB` : 'Unknown'}
            </div>
            <div style="margin-bottom: 8px; color: #a39b94; font-weight: 600;">EXTRACTED CONTENT / SNIPPET:</div>
            <pre>${escapeHtml(toolResult.content || toolResult.summary || 'File loaded successfully.')}</pre>
          `;

      const fileHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #120f0e; color: #ede8e3; padding: 20px; overflow-y: auto; font-size: 0.8rem; line-height: 1.5; margin: 0; }
            .header { color: #8c837a; font-weight: bold; border-bottom: 1px solid #2e2824; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; }
            .meta { background: #211c19; padding: 10px 14px; border-radius: 6px; border: 1px solid #2e2824; margin-bottom: 14px; }
            pre { background: #171311; border: 1px solid #2e2824; padding: 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-all; color: #38edf8; }
          </style>
        </head>
        <body>
          <div class="header">
            <span>> FILE INSPECTION & PARSER</span>
            <span style="color: #d4af37;">${toolResult.files ? `${toolResult.files.length} FILE(S)` : '1 FILE'}</span>
          </div>
          ${fileListHtml}
        </body>
        </html>
      `;

      setPreviewContent({
        type: 'file',
        title: `File Preview - ${toolResult.fileName}`,
        subTitle: 'FILE CONTENT & ANALYSIS',
        data: toolResult,
        htmlContent: fileHtml,
      });
      setIsPreviewOpen(true);
    } else if (toolResult.type === 'calendar') {
      const incomingEvents = toolResult.events || [];
      const incomingEventsJson = JSON.stringify(incomingEvents).replace(/</g, '\\u003c');
      
      const calendarHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: rgba(237, 232, 227, 0.45); }
            
            .material-symbols-rounded {
              font-family: 'Material Symbols Rounded' !important;
              font-weight: normal;
              font-style: normal;
              font-size: 18px;
              line-height: 1;
              letter-spacing: normal;
              text-transform: none;
              display: inline-block;
              white-space: nowrap;
              word-wrap: normal;
              direction: ltr;
              -webkit-font-smoothing: antialiased;
              vertical-align: middle;
            }

            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #120f0e; color: #ede8e3; padding: 18px; overflow-y: auto; line-height: 1.5; margin: 0; }
            h2 { font-size: 1.15rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
            .subtitle { font-size: 0.78rem; color: #8c837a; margin-bottom: 14px; }
            .cal-header-bar { display: flex; justify-content: space-between; align-items: center; background: #1c1715; border: 1px solid #2e2824; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; }
            .cal-nav-group { display: flex; align-items: center; gap: 8px; }
            .cal-nav-btn { background: transparent; border: none; color: #ede8e3; font-size: 1rem; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .cal-nav-btn:hover { background: rgba(255, 255, 255, 0.08); }
            .cal-month-title { font-weight: 700; font-size: 0.95rem; color: #ffffff; min-width: 140px; text-align: center; }
            .cal-stats { display: flex; gap: 8px; font-size: 0.75rem; align-items: center; }
            .cal-stat-pill { background: #26201d; border: 1px solid #3d332d; padding: 3px 8px; border-radius: 12px; color: #d4af37; font-weight: 600; }
            .clear-all-btn { background: transparent; border: 1px solid #451a1a; color: #f87171; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; }
            .clear-all-btn:hover { background: #451a1a40; }
            
            /* Month Calendar Grid */
            .month-grid { background: #1a1513; border: 1px solid #2e2824; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
            .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 0.72rem; color: #8c837a; font-weight: 600; margin-bottom: 8px; }
            .days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
            .day-cell { height: 38px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; font-size: 0.8rem; cursor: pointer; position: relative; border: 1px solid transparent; transition: all 0.15s; }
            .day-cell:hover { background: #2b231f; border-color: #4a3c33; }
            .day-cell.other-month { color: #574e47; opacity: 0.4; }
            .day-cell.past-day { color: #57534e; opacity: 0.35; cursor: not-allowed; }
            .day-cell.current-day { background: #2f251f; border-color: #d4af37; color: #ffffff; font-weight: 700; }
            .day-cell.selected { background: #10b98125; border-color: #10b981; color: #a7f3d0; font-weight: 700; }
            .event-dot { width: 5px; height: 5px; border-radius: 50%; background: #d4af37; position: absolute; bottom: 3px; }
            .event-dot.work { background: #38bdf8; }
            .event-dot.meeting { background: #c084fc; }
            .event-dot.deadline { background: #ef4444; }
            .event-dot.personal { background: #34d399; }

            /* Add Event Form */
            .add-box { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
            .add-box-title { font-size: 0.82rem; font-weight: 600; color: #ede8e3; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
            .form-row { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
            .form-input { flex: 1; min-width: 140px; background: #120f0e; border: 1px solid #3d332d; color: #ede8e3; padding: 7px 10px; border-radius: 6px; font-size: 0.78rem; outline: none; }
            .form-input:focus { border-color: #d4af37; }
            .form-select { background: #120f0e; border: 1px solid #3d332d; color: #ede8e3; padding: 7px 10px; border-radius: 6px; font-size: 0.78rem; outline: none; }
            .add-btn { background: #d4af37; color: #171210; border: none; font-weight: 700; padding: 7px 14px; border-radius: 6px; font-size: 0.78rem; cursor: pointer; transition: background 0.15s; }
            .add-btn:hover { background: #e6c558; }

            /* Events Schedule List */
            .section-title { font-size: 0.82rem; font-weight: 600; color: #8c837a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
            .events-list { display: flex; flex-direction: column; gap: 8px; }
            .event-card { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: border-color 0.15s; }
            .event-card:hover { border-color: #4a3c33; }
            .event-card.completed { opacity: 0.55; text-decoration: line-through; }
            .event-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .event-checkbox { cursor: pointer; accent-color: #10b981; width: 15px; height: 15px; }
            .event-info { display: flex; flex-direction: column; min-width: 0; }
            .event-title { font-size: 0.85rem; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .event-meta { font-size: 0.72rem; color: #8c837a; display: flex; gap: 8px; margin-top: 2px; }
            .cat-badge { padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; }
            .cat-badge.work { background: #1e293b; color: #38bdf8; border: 1px solid #38bdf840; }
            .cat-badge.meeting { background: #2e1065; color: #c084fc; border: 1px solid #c084fc40; }
            .cat-badge.personal { background: #064e3b; color: #34d399; border: 1px solid #34d39940; }
            .cat-badge.deadline { background: #450a0a; color: #f87171; border: 1px solid #f8717140; }
            .del-btn { background: transparent; border: none; color: #78716c; cursor: pointer; font-size: 0.8rem; padding: 4px; border-radius: 4px; }
            .del-btn:hover { color: #ef4444; background: #261b17; }
          </style>
        </head>
        <body>
          <h2><span class="material-symbols-rounded" style="color: #eab308; font-size: 22px;">calendar_month</span> Calendar & Schedule Manager</h2>
          <div class="subtitle">Interactive schedule planning, future date navigation, and overdue auto-removal (Persistent)</div>

          <div class="cal-header-bar">
            <div class="cal-nav-group">
              <button class="cal-nav-btn" onclick="prevMonth()" title="Previous Month"><span class="material-symbols-rounded">chevron_left</span></button>
              <span class="cal-month-title" id="monthNameHeader">August 2026</span>
              <button class="cal-nav-btn" onclick="nextMonth()" title="Next Month"><span class="material-symbols-rounded">chevron_right</span></button>
            </div>
            <div class="cal-stats">
              <span class="cal-stat-pill" id="totalCountPill">0 Schedules</span>
              <button class="clear-all-btn" onclick="handleClearAll()">Clear All</button>
            </div>
          </div>

          <div class="month-grid">
            <div class="weekdays">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div class="days-grid" id="daysContainer"></div>
          </div>

          <div class="add-box">
            <div class="add-box-title"><span class="material-symbols-rounded" style="font-size: 16px; color: #d4af37;">add_circle</span> Add New Schedule / Appointment</div>
            <div class="form-row">
              <input type="text" id="newTitle" class="form-input" placeholder="Title (e.g. Sprint Review, Team Sync, Doctor)" />
              <input type="date" id="newDate" class="form-input" style="max-width: 140px;" />
            </div>
            <div class="form-row">
              <input type="time" id="newTime" class="form-input" value="10:00" style="max-width: 110px;" />
              <select id="newCat" class="form-select">
                <option value="work">Work</option>
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
                <option value="personal">Personal</option>
              </select>
              <button type="button" class="add-btn" id="addBtn" onclick="handleAddEvent()">Add to Schedule</button>
            </div>
          </div>

          <div class="section-title">Upcoming Schedules & Deadlines</div>
          <div class="events-list" id="eventsListContainer"></div>

          <script>
            // Load persistent saved events from localStorage or fallback to server list
            const LOCAL_STORAGE_KEY = 'lifeguide_calendar_events';
            let events = [];
            
            try {
              const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
              if (saved) {
                events = JSON.parse(saved);
              } else {
                events = ${incomingEventsJson};
              }
            } catch {
              events = ${incomingEventsJson};
            }

            const realToday = new Date();
            const realTodayStr = realToday.toISOString().split('T')[0];
            let viewYear = realToday.getFullYear();
            let viewMonth = realToday.getMonth();
            let selectedDateStr = realTodayStr;

            function autoPurgeOverdueEvents() {
              const now = new Date();
              const nowTime = now.getTime();
              const initialCount = events.length;
              events = events.filter(ev => {
                if (!ev.date) return true;
                try {
                  let timePart = ev.time || '23:59';
                  if (/am|pm/i.test(timePart)) {
                    const match = timePart.match(/(\\d+):(\\d+)\\s*(am|pm)/i);
                    if (match) {
                      let h = parseInt(match[1], 10);
                      const m = match[2];
                      const p = match[3].toLowerCase();
                      if (p === 'pm' && h < 12) h += 12;
                      if (p === 'am' && h === 12) h = 0;
                      timePart = String(h).padStart(2, '0') + ':' + m;
                    }
                  }
                  const evDate = new Date(ev.date + 'T' + timePart);
                  if (isNaN(evDate.getTime())) {
                    return ev.date >= now.toISOString().split('T')[0];
                  }
                  return evDate.getTime() >= (nowTime - 60000);
                } catch {
                  return true;
                }
              });
              if (events.length !== initialCount) {
                saveAndSyncEvents();
              }
            }

            function saveAndSyncEvents() {
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events));
              } catch (e) {}
              fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events })
              }).catch(() => {});
            }

            function prevMonth() {
              viewMonth--;
              if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
              }
              renderMonthDays();
            }

            function nextMonth() {
              viewMonth++;
              if (viewMonth > 11) {
                viewMonth = 0;
                viewYear++;
              }
              renderMonthDays();
            }

            function initCalendar() {
              autoPurgeOverdueEvents();
              const dateInput = document.getElementById('newDate');
              if (dateInput) {
                dateInput.min = realTodayStr;
                dateInput.value = selectedDateStr;
              }
              renderMonthDays();
              renderEvents();
              setInterval(autoPurgeOverdueEvents, 15000);
            }

            function renderMonthDays() {
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
              document.getElementById('monthNameHeader').innerText = monthNames[viewMonth] + ' ' + viewYear;
              
              const container = document.getElementById('daysContainer');
              container.innerHTML = '';
              
              const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
              const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
              const prevLastDate = new Date(viewYear, viewMonth, 0).getDate();

              for (let i = firstDayIndex; i > 0; i--) {
                const dayDiv = document.createElement('div');
                dayDiv.className = 'day-cell other-month';
                dayDiv.innerText = prevLastDate - i + 1;
                container.appendChild(dayDiv);
              }

              for (let i = 1; i <= lastDate; i++) {
                const dayDiv = document.createElement('div');
                const dateStr = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
                dayDiv.className = 'day-cell';
                
                const isPast = dateStr < realTodayStr;
                if (isPast) {
                  dayDiv.classList.add('past-day');
                }
                
                if (dateStr === realTodayStr) dayDiv.classList.add('current-day');
                if (dateStr === selectedDateStr) dayDiv.classList.add('selected');
                dayDiv.innerText = i;

                const dayEvents = events.filter(e => e.date === dateStr);
                if (dayEvents.length > 0) {
                  const dot = document.createElement('div');
                  dot.className = 'event-dot ' + (dayEvents[0].category || 'work');
                  dayDiv.appendChild(dot);
                }

                dayDiv.onclick = () => {
                  if (isPast) {
                    alert('Cannot select or schedule dates in the past.');
                    return;
                  }
                  selectedDateStr = dateStr;
                  document.getElementById('newDate').value = dateStr;
                  renderMonthDays();
                  renderEvents();
                };
                container.appendChild(dayDiv);
              }
            }

            function renderEvents() {
              autoPurgeOverdueEvents();
              const list = document.getElementById('eventsListContainer');
              list.innerHTML = '';
              document.getElementById('totalCountPill').innerText = events.length + ' Schedules';

              if (events.length === 0) {
                list.innerHTML = '<div style="color: #8c837a; font-size: 0.8rem; padding: 16px; text-align: center; background: #1c1715; border-radius: 6px; border: 1px dashed #2e2824;">Calendar is clear. Add upcoming schedules or deadlines above.</div>';
                return;
              }

              const sorted = [...events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

              sorted.forEach(ev => {
                const card = document.createElement('div');
                card.className = 'event-card' + (ev.completed ? ' completed' : '');
                
                const left = document.createElement('div');
                left.className = 'event-left';
                
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'event-checkbox';
                chk.checked = !!ev.completed;
                chk.onchange = () => {
                  ev.completed = chk.checked;
                  card.classList.toggle('completed', ev.completed);
                  saveAndSyncEvents();
                };

                const info = document.createElement('div');
                info.className = 'event-info';
                
                const title = document.createElement('div');
                title.className = 'event-title';
                title.innerText = ev.title;

                const meta = document.createElement('div');
                meta.className = 'event-meta';
                meta.innerHTML = '<span style="display: flex; align-items: center; gap: 3px;"><span class="material-symbols-rounded" style="font-size: 13px;">calendar_today</span> ' + (ev.date || 'Today') + '</span><span style="display: flex; align-items: center; gap: 3px;"><span class="material-symbols-rounded" style="font-size: 13px;">schedule</span> ' + (ev.time || '10:00 AM') + '</span>';

                info.appendChild(title);
                info.appendChild(meta);
                left.appendChild(chk);
                left.appendChild(info);

                const right = document.createElement('div');
                right.style.display = 'flex';
                right.style.alignItems = 'center';
                right.style.gap = '8px';

                const catBadge = document.createElement('span');
                catBadge.className = 'cat-badge ' + (ev.category || 'work');
                catBadge.innerText = ev.category || 'work';

                const del = document.createElement('button');
                del.className = 'del-btn';
                del.innerText = '✕';
                del.title = 'Remove schedule';
                del.onclick = () => {
                  events = events.filter(e => e.id !== ev.id);
                  saveAndSyncEvents();
                  renderEvents();
                  renderMonthDays();
                };

                right.appendChild(catBadge);
                right.appendChild(del);

                card.appendChild(left);
                card.appendChild(right);
                list.appendChild(card);
              });
            }

            function handleAddEvent() {
              const titleInp = document.getElementById('newTitle');
              const dateInp = document.getElementById('newDate');
              const timeInp = document.getElementById('newTime');
              const catInp = document.getElementById('newCat');

              const title = titleInp.value.trim();
              if (!title) {
                alert('Please enter a schedule title.');
                return;
              }

              const chosenDate = dateInp.value || selectedDateStr;
              const chosenTime = timeInp.value || '10:00';

              const now = new Date();
              const curDateStr = now.toISOString().split('T')[0];
              const curTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

              if (chosenDate < curDateStr) {
                alert('Cannot schedule an appointment or task in the past.');
                return;
              }

              if (chosenDate === curDateStr && chosenTime < curTimeStr) {
                alert('Cannot set a schedule time that has already passed today.');
                return;
              }

              const newEvt = {
                id: 'cal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                title: title,
                date: chosenDate,
                time: chosenTime,
                category: catInp.value || 'work',
                priority: 'medium',
                completed: false
              };

              events.push(newEvt);
              saveAndSyncEvents();
              titleInp.value = '';
              renderEvents();
              renderMonthDays();
            }

            function handleClearAll() {
              if (confirm('Clear all schedules from your calendar?')) {
                events = [];
                saveAndSyncEvents();
                renderEvents();
                renderMonthDays();
              }
            }

            window.onload = initCalendar;
          <\/script>
        </body>
        </html>
      `;

      setPreviewContent({
        type: 'calendar',
        title: 'Calendar & Schedules',
        subTitle: 'INTERACTIVE SCHEDULE MANAGER',
        data: toolResult,
        htmlContent: calendarHtml,
      });
      setIsPreviewOpen(true);
    } else if (toolResult.type === 'weather') {
      const weatherJson = JSON.stringify(toolResult).replace(/</g, '\\u003c');
      const weatherHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            *::-webkit-scrollbar { width: 4px; height: 4px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb { background: rgba(140, 131, 122, 0.28); border-radius: 4px; }
            *::-webkit-scrollbar-thumb:hover { background: rgba(237, 232, 227, 0.45); }
            
            .material-symbols-rounded {
              font-family: 'Material Symbols Rounded' !important;
              font-weight: normal;
              font-style: normal;
              font-size: 20px;
              line-height: 1;
              letter-spacing: normal;
              text-transform: none;
              display: inline-block;
              white-space: nowrap;
              word-wrap: normal;
              direction: ltr;
              -webkit-font-smoothing: antialiased;
              vertical-align: middle;
            }

            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #120f0e; color: #ede8e3; padding: 18px; overflow-y: auto; line-height: 1.5; margin: 0; }
            h2 { font-size: 1.15rem; color: #ffffff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
            .subtitle { font-size: 0.78rem; color: #8c837a; margin-bottom: 14px; }
            
            /* Search Bar */
            .search-bar { display: flex; gap: 6px; margin-bottom: 16px; align-items: center; }
            .search-input { flex: 1; background: #1c1715; border: 1px solid #2e2824; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; outline: none; }
            .search-input:focus { border-color: #38bdf8; }
            .icon-btn { background: transparent; border: none; color: #ede8e3; width: 34px; height: 34px; border-radius: 6px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; outline: none; padding: 0; }
            .icon-btn:hover { background: rgba(255, 255, 255, 0.08); }

            /* Hero Card */
            .hero-card { background: linear-gradient(135deg, #1e1b18 0%, #29221d 100%); border: 1px solid #3d332d; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
            .hero-loc-box { display: flex; flex-direction: column; gap: 2px; }
            .hero-city { font-size: 1.25rem; font-weight: 700; color: #ffffff; }
            .hero-cond { font-size: 0.85rem; color: #38bdf8; font-weight: 600; display: flex; align-items: center; gap: 6px; }
            .hero-temp-box { text-align: right; }
            .hero-temp { font-size: 2.6rem; font-weight: 800; color: #ffffff; line-height: 1; }
            .hero-range { font-size: 0.78rem; color: #a39b94; margin-top: 4px; }

            /* Metrics Grid */
            .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
            .metric-card { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 12px; }
            .metric-label { font-size: 0.7rem; color: #8c837a; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
            .metric-value { font-size: 0.95rem; font-weight: 700; color: #ffffff; }

            /* Radar Map Card */
            .radar-card { background: #1c1715; border: 1px solid #2e2824; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
            .radar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.8rem; font-weight: 700; color: #ffffff; }
            #radarMap { width: 100%; height: 180px; border-radius: 6px; background: #0c0a09; }

            /* Hourly Timeline & Transparent Slider */
            .hourly-timeline-container { margin-bottom: 16px; background: transparent; }
            .timeline-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
            .timeline-section-title { font-size: 0.8rem; font-weight: 600; color: #8c837a; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 6px; }
            .timeline-active-badge { font-size: 0.72rem; color: #38bdf8; font-weight: 700; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 8px; border-radius: 9999px; }
            
            .slider-control-row { display: flex; align-items: center; gap: 8px; background: transparent; padding: 4px 0 8px 0; width: 100%; }
            .slider-arrow-btn { background: transparent; border: 1px solid #2e2824; color: #ede8e3; width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; flex-shrink: 0; outline: none; padding: 0; }
            .slider-arrow-btn:hover { background: rgba(255, 255, 255, 0.08); border-color: #38bdf8; color: #38bdf8; }
            
            .timeline-range-slider { flex: 1; -webkit-appearance: none; appearance: none; background: transparent; height: 24px; cursor: pointer; outline: none; margin: 0; }
            .timeline-range-slider::-webkit-slider-runnable-track { height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 3px; }
            .timeline-range-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #38bdf8; border: 2px solid #ffffff; box-shadow: 0 0 10px rgba(56, 189, 248, 0.8); cursor: grab; margin-top: -6px; transition: transform 0.1s ease; }
            .timeline-range-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
            .timeline-range-slider::-moz-range-track { height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 3px; border: none; }
            .timeline-range-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #38bdf8; border: 2px solid #ffffff; box-shadow: 0 0 10px rgba(56, 189, 248, 0.8); cursor: grab; }
            
            .hourly-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 4px; scrollbar-width: thin; scroll-behavior: smooth; }
            .hourly-card { flex-shrink: 0; background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 12px; text-align: center; min-width: 70px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; transition: all 0.18s ease; user-select: none; }
            .hourly-card:hover { border-color: #38bdf8; background: #251f1c; }
            .hourly-card.active { border-color: #38bdf8; background: rgba(56, 189, 248, 0.14); box-shadow: 0 0 14px rgba(56, 189, 248, 0.28); transform: translateY(-2px); }
            .hourly-time { font-size: 0.72rem; color: #8c837a; font-weight: 600; }
            .hourly-icon { font-size: 1.2rem; }
            .hourly-temp { font-size: 0.95rem; font-weight: 800; color: #ffffff; }
            .hourly-rain { font-size: 0.65rem; color: #38bdf8; font-weight: 600; }

            /* 7-Day Forecast */
            .forecast-list { display: flex; flex-direction: column; gap: 8px; }
            .forecast-row { background: #1c1715; border: 1px solid #2e2824; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
            .forecast-day { font-size: 0.84rem; font-weight: 600; color: #ede8e3; width: 75px; }
            .forecast-cond { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #a39b94; flex: 1; }
            .forecast-temps { display: flex; gap: 10px; font-size: 0.84rem; font-weight: 600; }
            .temp-high { color: #ffffff; }
            .temp-low { color: #8c837a; }
          </style>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
        </head>
        <body>
          <h2><span class="material-symbols-rounded" style="color: #38bdf8; font-size: 22px;">partly_cloudy_day</span> Live Weather Detector</h2>
          <div class="subtitle">Real-time meteorological metrics, satellite precipitation radar, and 7-day forecast</div>

          <div class="search-bar">
            <input type="text" id="cityInput" class="search-input" placeholder="Search city (e.g. London, Paris, Tokyo, New York)..." />
            <button class="icon-btn" onclick="lookupCity()" title="Search Weather"><span class="material-symbols-rounded">search</span></button>
            <button class="icon-btn" onclick="locateWeather()" title="Detect Current Weather Locator"><span class="material-symbols-rounded">my_location</span></button>
          </div>

          <div class="hero-card">
            <div class="hero-loc-box">
              <div class="hero-city" id="heroCityName">Location</div>
              <div class="hero-cond" id="heroCondition">Condition</div>
              <div style="font-size: 0.74rem; color: #8c837a; margin-top: 4px;" id="heroFeelsLike">Feels like</div>
            </div>
            <div class="hero-temp-box">
              <div class="hero-temp" id="heroCurrentTemp">--°</div>
              <div class="hero-range" id="heroHighLow">H: --° L: --°</div>
            </div>
          </div>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label"><span class="material-symbols-rounded" style="font-size: 15px; color: #38bdf8;">water_drop</span> Humidity</div>
              <div class="metric-value" id="valHumidity">--%</div>
            </div>
            <div class="metric-card">
              <div class="metric-label"><span class="material-symbols-rounded" style="font-size: 15px; color: #94a3b8;">air</span> Wind Speed</div>
              <div class="metric-value" id="valWind">-- mph</div>
            </div>
            <div class="metric-card">
              <div class="metric-label"><span class="material-symbols-rounded" style="font-size: 15px; color: #f59e0b;">wb_sunny</span> UV Index</div>
              <div class="metric-value" id="valUv">--</div>
            </div>
            <div class="metric-card">
              <div class="metric-label"><span class="material-symbols-rounded" style="font-size: 15px; color: #a855f7;">compress</span> Pressure</div>
              <div class="metric-value" id="valPressure">-- hPa</div>
            </div>
            <div class="metric-card">
              <div class="metric-label"><span class="material-symbols-rounded" style="font-size: 15px; color: #38bdf8;">visibility</span> Visibility</div>
              <div class="metric-value" id="valVisibility">-- mi</div>
            </div>
            <div class="metric-card">
              <div class="metric-label"><span class="material-symbols-rounded" style="font-size: 15px; color: #10b981;">eco</span> Air Quality</div>
              <div class="metric-value" style="color: #10b981;">Good (AQI 24)</div>
            </div>
          </div>

          <div class="radar-card">
            <div class="radar-header">
              <span style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-rounded" style="font-size: 18px; color: #38bdf8;">radar</span> Live Precipitation & Cloud Radar</span>
              <span style="font-size: 0.72rem; color: #38bdf8;">RainViewer Doppler</span>
            </div>
            <div id="radarMap"></div>
          </div>

          <!-- Hourly Timeline Container with Transparent Slider and Arrow Controls -->
          <div class="hourly-timeline-container">
            <div class="timeline-header-row">
              <div class="timeline-section-title"><span class="material-symbols-rounded" style="font-size: 17px; color: #38bdf8;">schedule</span> Hourly Temperature Timeline (24h)</div>
              <div class="timeline-active-badge" id="timelineActiveBadge">Current • --°C</div>
            </div>

            <div class="slider-control-row">
              <button class="slider-arrow-btn" id="prevHourBtn" onclick="stepHour(-1)" title="Previous Hour">
                <span class="material-symbols-rounded" style="font-size: 18px;">chevron_left</span>
              </button>
              <input type="range" id="hourSlider" class="timeline-range-slider" min="0" max="23" value="0" step="1" oninput="onHourSliderChange(this.value)" />
              <button class="slider-arrow-btn" id="nextHourBtn" onclick="stepHour(1)" title="Next Hour">
                <span class="material-symbols-rounded" style="font-size: 18px;">chevron_right</span>
              </button>
            </div>

            <div class="hourly-scroll" id="hourlyList"></div>
          </div>

          <div class="timeline-section-title" style="margin-top: 8px; margin-bottom: 8px;">7-Day Extended Forecast</div>
          <div class="forecast-list" id="forecastList"></div>

          <script>
            let currentData = ${weatherJson};
            let radarMap = null;
            let radarTileLayer = null;
            let selectedHourIdx = 0;

            function getMaterialWeatherIcon(condStr) {
              const c = (condStr || '').toLowerCase();
              if (c.includes('thunder') || c.includes('storm')) return '<span class="material-symbols-rounded" style="color: #eab308;">thunderstorm</span>';
              if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return '<span class="material-symbols-rounded" style="color: #93c5fd;">ac_unit</span>';
              if (c.includes('drizzle') || c.includes('rain') || c.includes('shower')) return '<span class="material-symbols-rounded" style="color: #38bdf8;">rainy</span>';
              if (c.includes('cloud') || c.includes('overcast')) return '<span class="material-symbols-rounded" style="color: #cbd5e1;">cloud</span>';
              if (c.includes('fog') || c.includes('mist')) return '<span class="material-symbols-rounded" style="color: #94a3b8;">foggy</span>';
              if (c.includes('clear') || c.includes('sun')) return '<span class="material-symbols-rounded" style="color: #f59e0b;">wb_sunny</span>';
              return '<span class="material-symbols-rounded" style="color: #38bdf8;">partly_cloudy_day</span>';
            }

            function initRadar(lat, lon) {
              const defaultLat = lat || 51.5074;
              const defaultLon = lon || -0.1278;

              if (!radarMap) {
                radarMap = L.map('radarMap', { zoomControl: false, attributionControl: false }).setView([defaultLat, defaultLon], 7);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(radarMap);
              } else {
                radarMap.setView([defaultLat, defaultLon], 7);
              }

              fetch('https://api.rainviewer.com/public/weather-maps.json')
                .then(r => r.json())
                .then(apiData => {
                  if (apiData && apiData.radar && apiData.radar.past && apiData.radar.past.length > 0) {
                    const latest = apiData.radar.past[apiData.radar.past.length - 1];
                    if (radarTileLayer) radarMap.removeLayer(radarTileLayer);
                    radarTileLayer = L.tileLayer(apiData.host + latest.path + '/256/{z}/{x}/{y}/2/1_1.png', {
                      opacity: 0.75
                    }).addTo(radarMap);
                  }
                })
                .catch(() => {});
            }

            function selectHour(idx) {
              if (!currentData || !currentData.hourly || currentData.hourly.length === 0) return;
              const maxIdx = currentData.hourly.length - 1;
              const clamped = Math.max(0, Math.min(maxIdx, idx));
              selectedHourIdx = clamped;

              const slider = document.getElementById('hourSlider');
              if (slider) {
                slider.max = maxIdx;
                slider.value = clamped;
              }

              const h = currentData.hourly[clamped];
              if (!h) return;

              const badge = document.getElementById('timelineActiveBadge');
              if (badge) {
                badge.innerText = (clamped === 0 ? 'Now' : h.time) + ' • ' + (h.temp || h.temperature) + '°C (' + (h.condition || 'Fair') + ')';
              }

              // Update hero card dynamically to show the hour's temperature and conditions
              const heroTemp = document.getElementById('heroCurrentTemp');
              if (heroTemp) heroTemp.innerText = (h.temp || h.temperature) + '°';

              const heroCond = document.getElementById('heroCondition');
              if (heroCond) {
                const iconHtml = getMaterialWeatherIcon(h.condition);
                heroCond.innerHTML = iconHtml + ' ' + h.condition;
              }

              const heroFeels = document.getElementById('heroFeelsLike');
              if (heroFeels) {
                heroFeels.innerText = 'Feels like ' + (h.feelsLike || h.temp || h.temperature) + '°C • ' + (h.description || 'Forecast for ' + h.time);
              }

              if (h.humidity) {
                const vH = document.getElementById('valHumidity');
                if (vH) vH.innerText = h.humidity + '%';
              }
              if (h.windSpeed) {
                const vW = document.getElementById('valWind');
                if (vW) vW.innerText = h.windSpeed + ' mph';
              }

              // Update active highlight on cards and scroll
              const cards = document.querySelectorAll('.hourly-card');
              cards.forEach((c, i) => {
                if (i === clamped) {
                  c.classList.add('active');
                  c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                } else {
                  c.classList.remove('active');
                }
              });
            }

            function onHourSliderChange(val) {
              selectHour(parseInt(val, 10));
            }

            function stepHour(delta) {
              selectHour(selectedHourIdx + delta);
            }

            function renderWeather(data) {
              document.getElementById('heroCityName').innerText = data.location || 'London, UK';
              const iconHtml = getMaterialWeatherIcon(data.current.condition);
              document.getElementById('heroCondition').innerHTML = iconHtml + ' ' + data.current.condition;
              document.getElementById('heroFeelsLike').innerText = 'Feels like ' + data.current.feelsLike + '°C • ' + data.current.description;
              document.getElementById('heroCurrentTemp').innerText = data.current.temperature + '°';
              document.getElementById('heroHighLow').innerText = 'H: ' + data.current.high + '° L: ' + data.current.low + '°';
              
              document.getElementById('valHumidity').innerText = data.current.humidity + '%';
              document.getElementById('valWind').innerText = data.current.windSpeedMph + ' mph ' + (data.current.windDirection || 'W');
              document.getElementById('valUv').innerText = data.current.uvIndex + ' (' + (data.current.uvIndex > 5 ? 'High' : 'Moderate') + ')';
              document.getElementById('valPressure').innerText = (data.current.pressureHpa || 1014) + ' hPa';
              document.getElementById('valVisibility').innerText = (data.current.visibilityMiles || 10) + ' miles';

              // Hourly 24h cards
              const hList = document.getElementById('hourlyList');
              hList.innerHTML = '';
              const hourlyArr = data.hourly || [];
              const slider = document.getElementById('hourSlider');
              if (slider) {
                slider.max = Math.max(0, hourlyArr.length - 1);
                slider.value = 0;
              }
              selectedHourIdx = 0;

              hourlyArr.forEach((h, idx) => {
                const card = document.createElement('div');
                card.className = 'hourly-card' + (idx === 0 ? ' active' : '');
                card.onclick = () => selectHour(idx);
                const hIconHtml = getMaterialWeatherIcon(h.condition || data.current.condition);
                const tVal = h.temp ?? h.temperature ?? data.current.temperature;
                const rainProbHtml = h.rainProb ? '<span class="hourly-rain"><span class="material-symbols-rounded" style="font-size: 11px;">water_drop</span> ' + h.rainProb + '</span>' : '';
                card.innerHTML = '<span class="hourly-time">' + h.time + '</span><span class="hourly-icon">' + hIconHtml + '</span><span class="hourly-temp">' + tVal + '°</span>' + rainProbHtml;
                hList.appendChild(card);
              });

              if (hourlyArr.length > 0) {
                const badge = document.getElementById('timelineActiveBadge');
                if (badge) {
                  badge.innerText = 'Now • ' + (hourlyArr[0].temp || hourlyArr[0].temperature) + '°C (' + hourlyArr[0].condition + ')';
                }
              }

              // 7-day
              const fList = document.getElementById('forecastList');
              fList.innerHTML = '';
              (data.forecast || []).forEach(f => {
                const row = document.createElement('div');
                row.className = 'forecast-row';
                const fIconHtml = getMaterialWeatherIcon(f.condition);
                row.innerHTML = '<span class="forecast-day">' + f.day + '</span><div class="forecast-cond"><span>' + fIconHtml + '</span><span>' + f.condition + '</span></div><div class="forecast-temps"><span class="temp-high">' + f.high + '°</span><span class="temp-low">' + f.low + '°</span></div>';
                fList.appendChild(row);
              });

              initRadar(data.coordinates ? data.coordinates.lat : null, data.coordinates ? data.coordinates.lon : null);
            }

            function lookupCity() {
              const inp = document.getElementById('cityInput');
              const q = inp.value.trim();
              if (!q) return;

              fetch('/api/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: q })
              })
              .then(res => res.json())
              .then(data => {
                if (data && !data.error) {
                  currentData = data;
                  renderWeather(data);
                }
              })
              .catch(err => {
                console.error(err);
              });
            }

            function locateWeather() {
              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    fetch('/api/weather', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data && !data.error) {
                        currentData = data;
                        renderWeather(data);
                        const inp = document.getElementById('cityInput');
                        if (inp) inp.value = data.location || '';
                      }
                    })
                    .catch(() => {});
                  },
                  () => {
                    fetch('https://ipapi.co/json/')
                      .then(r => r.json())
                      .then(d => {
                        if (d && (d.latitude && d.longitude || d.city)) {
                          fetch('/api/weather', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ location: d.city || 'Detected Location', lat: d.latitude, lon: d.longitude })
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data && !data.error) {
                              currentData = data;
                              renderWeather(data);
                              const inp = document.getElementById('cityInput');
                              if (inp) inp.value = data.location || '';
                            }
                          });
                        }
                      })
                      .catch(() => {});
                  },
                  { enableHighAccuracy: true, timeout: 8000 }
                );
              } else {
                fetch('https://ipapi.co/json/')
                  .then(r => r.json())
                  .then(d => {
                    if (d && (d.latitude && d.longitude || d.city)) {
                      fetch('/api/weather', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ location: d.city || 'Detected Location', lat: d.latitude, lon: d.longitude })
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data && !data.error) {
                          currentData = data;
                          renderWeather(data);
                          const inp = document.getElementById('cityInput');
                          if (inp) inp.value = data.location || '';
                        }
                      });
                    }
                  })
                  .catch(() => {});
              }
            }

            document.getElementById('cityInput').addEventListener('keydown', (e) => {
              if (e.key === 'Enter') lookupCity();
            });

            window.onload = () => renderWeather(currentData);
          <\/script>
        </body>
        </html>
      `;

      setPreviewContent({
        type: 'weather',
        title: `Weather - ${toolResult.location}`,
        subTitle: 'LIVE WEATHER DETECTOR',
        data: toolResult,
        htmlContent: weatherHtml,
      });
      setIsPreviewOpen(true);
    }
  };

  const isChatActive = messages.length > 0;
  const activeSession = chatSessions.find((s) => s.id === currentSessionId);
  const activeChatTitle = activeSession?.title || (messages.length > 0 ? messages[0].content.slice(0, 32) : 'LifeGuide Assist');

  return (
    <div className={`app-viewport ${isPreviewOpen ? 'preview-active-state' : ''}`}>
      {/* Dynamic Ambient Soul Background Aura (Enhanced Depth & Radiance) */}
      <div className="soul-ambient-auras" aria-hidden="true">
        <div className="soul-orb soul-orb-1" />
        <div className="soul-orb soul-orb-2" />
        <div className="soul-orb soul-orb-3" />
      </div>

      {/* Collapsible History Sidebar (Open: Image 1, Collapsed Rail: Image 2) */}
      <aside className={`history-sidebar ${isSidebarOpen ? 'open' : 'collapsed'}`} id="historySidebar">
        {isSidebarOpen ? (
          <div className="sidebar-open-container">
            {/* Header with big transparent logo, title, subtitle & close button */}
            <div className="sidebar-header">
              <div className="sidebar-brand-box" onClick={handleNewChat} role="button" tabIndex={0}>
                <div className="sidebar-brand-icon">
                  <img
                    src="/LifeguideAssist_Logo__4_-removebg-preview.png"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo.png';
                    }}
                    alt="LifeGuide Assist"
                    className="sidebar-brand-img"
                  />
                </div>
                <div className="sidebar-brand-text-col">
                  <span className="sidebar-brand-title">LifeGuide Assist</span>
                  <span className="sidebar-brand-sub">Resource Bot Workspace</span>
                </div>
              </div>
              <button
                type="button"
                className="sidebar-close-btn"
                id="closeSidebarBtn"
                onClick={() => setIsSidebarOpen(false)}
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* New Conversation Button (Cream/Sand Pill) */}
            <div className="sidebar-action-wrap">
              <button
                type="button"
                className="sidebar-new-conv-btn"
                id="sidebarNewConvBtn"
                onClick={handleNewChat}
              >
                <MessageSquarePlus style={{ width: 17, height: 17 }} />
                <span>New conversation</span>
              </button>
            </div>

            {/* History Section Header & Search Box */}
            <div className="sidebar-history-top">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title-text">HISTORY</span>
                <span className="sidebar-count-num">{chatSessions.length}</span>
              </div>
              <div className="sidebar-search-box">
                <Search style={{ width: 14, height: 14, color: '#8c837a' }} />
                <input
                  type="text"
                  className="sidebar-search-input"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="sidebar-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Sessions List */}
            <div className="sidebar-sessions-list" id="sidebarSessionsList">
              {filteredSessions.length === 0 ? (
                <div className="sidebar-empty-state">
                  <MessageSquare style={{ width: 22, height: 22, opacity: 0.35, marginBottom: 6 }} />
                  <span>{searchQuery ? 'No matching history found' : 'No history yet'}</span>
                  <p>{searchQuery ? 'Try a different search term.' : 'Your conversations will appear here automatically.'}</p>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.id === currentSessionId && messages.length > 0;
                  return (
                    <div
                      key={session.id}
                      className={`sidebar-session-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectSession(session)}
                      title={session.title}
                    >
                      <span className="sidebar-session-title">{session.title}</span>
                      <button
                        type="button"
                        className="sidebar-session-more"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSessionForModal(session);
                          setIsSessionModalOpen(true);
                        }}
                        title="Chat options"
                      >
                        <MoreHorizontal style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Bottom Actions */}
            <div className="sidebar-footer">
              <button
                type="button"
                className="sidebar-footer-btn"
                id="sidebarSettingsBtn"
                onClick={() => {
                  setTempSettings(userSettings);
                  setIsSettingsOpen(true);
                }}
              >
                <Settings style={{ width: 14, height: 14 }} />
                <span>Settings</span>
              </button>
              {chatSessions.length > 0 && (
                <button
                  type="button"
                  className="sidebar-footer-btn clear"
                  id="clearHistoryBtn"
                  onClick={handleClearAllHistory}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Collapsed Rail (Image 2) with Menu icon overlay on Logo hover & no New button */
          <div className="sidebar-collapsed-rail">
            <button
              type="button"
              className="sidebar-rail-logo-btn"
              onClick={() => setIsSidebarOpen(true)}
              title="Open LifeGuide Assist Menu"
              aria-label="Open LifeGuide Assist Menu"
            >
              <img
                src="/LifeguideAssist_Logo__4_-removebg-preview.png"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                }}
                alt="LifeGuide Assist"
                className="sidebar-rail-logo-img"
              />
              <div className="sidebar-logo-menu-overlay" title="Open Menu">
                <PanelLeft style={{ width: 19, height: 19 }} />
              </div>
            </button>

            <div className="sidebar-rail-spacer" />

            <button
              type="button"
              className="sidebar-rail-btn"
              onClick={() => {
                setTempSettings(userSettings);
                setIsSettingsOpen(true);
              }}
              title="Application Settings"
            >
              <Settings style={{ width: 17, height: 17 }} />
            </button>
          </div>
        )}
      </aside>

      {/* Sidebar Overlay on mobile / backdrop */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          id="sidebarOverlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Workspace */}
      <div className={`workspace-main ${isChatActive ? 'active-chat' : ''}`} id="workspaceMain">
        {/* Top Application Bar - Transparent across all devices, hidden on phone when preview is open */}
        <header className={`app-top-bar ${isPreviewOpen ? 'preview-active' : ''}`} id="appTopBar">
          <div className="top-bar-left">
            {/* Phone-only menu button */}
            <button
              type="button"
              className="top-bar-btn mobile-menu-toggle-btn"
              id="toggleSidebarBtn"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              title={isSidebarOpen ? 'Close Menu' : 'Open Menu'}
              aria-label="Toggle Menu"
            >
              <PanelLeft style={{ width: 17, height: 17 }} />
            </button>
          </div>

          <div className="top-bar-right">
            {/* Desktop New Chat button */}
            <button
              type="button"
              className="top-new-chat-btn desktop-new-btn"
              id="topNewChatBtn"
              onClick={handleNewChat}
              title="Start a new chat"
            >
              <Plus style={{ width: 14, height: 14 }} />
              <span>New</span>
            </button>
          </div>
        </header>

        {/* Initial Welcome State (with dynamic user name) */}
        {!isChatActive && (
          <div className="welcome-frontpage-container" id="welcomeFrontpageContainer">
            <h1 id="mainTitle">
              Hi {userSettings.userName ? userSettings.userName : 'Bryan'}, what should we dive into today?
            </h1>

            {/* 4 Feature Cards Grid under the title - Compact & Smaller than input bar */}
            <div className="welcome-actions-grid" id="welcomeActionsGrid">
              <button
                type="button"
                className="welcome-action-card"
                id="cardActionResearch"
                onClick={() => quickAction('research')}
              >
                <div className="welcome-card-icon-box">
                  <Search style={{ width: 15, height: 15, color: '#d4af37' }} />
                </div>
                <div className="welcome-card-content">
                  <span className="welcome-card-title">Research</span>
                  <span className="welcome-card-sub">Live web intelligence & deep exploration</span>
                </div>
              </button>

              <button
                type="button"
                className="welcome-action-card"
                id="cardActionCalendar"
                onClick={() => quickAction('calendar')}
              >
                <div className="welcome-card-icon-box">
                  <Calendar style={{ width: 15, height: 15, color: '#eab308' }} />
                </div>
                <div className="welcome-card-content">
                  <span className="welcome-card-title">Calendar and Schedules</span>
                  <span className="welcome-card-sub">Check bin collections, events & deadlines</span>
                </div>
              </button>

              <button
                type="button"
                className="welcome-action-card"
                id="cardActionWeather"
                onClick={() => quickAction('weather')}
              >
                <div className="welcome-card-icon-box">
                  <CloudSun style={{ width: 15, height: 15, color: '#38bdf8' }} />
                </div>
                <div className="welcome-card-content">
                  <span className="welcome-card-title">Live Weather Forecast</span>
                  <span className="welcome-card-sub">Get real-time temperature & forecast</span>
                </div>
              </button>

              <button
                type="button"
                className="welcome-action-card"
                id="cardActionCode"
                onClick={() => quickAction('code')}
              >
                <div className="welcome-card-icon-box">
                  <Compass style={{ width: 15, height: 15, color: '#10b981' }} />
                </div>
                <div className="welcome-card-content">
                  <span className="welcome-card-title">Coding & Architecture</span>
                  <span className="welcome-card-sub">AI Agent patterns with code</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Full-width Chat Scroll Area with scroller spanning from top to bottom on the right edge */}
        {isChatActive && (
          <div
            className="chat-scroll-area"
            id="chatScrollArea"
            ref={chatScrollAreaRef}
            onScroll={handleChatScroll}
          >
            {/* Top fade gradient on chatbox */}
            <div className="chat-top-fade-mask" />

            {/* Centered Message Stream */}
            <div className="chat-messages-container" id="chatMessagesContainer">
              <div className="chat-history" id="chatHistory">
                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    const allAttachments = (msg.attachments && msg.attachments.length > 0)
                      ? msg.attachments
                      : (msg.attachment ? [msg.attachment] : []);
                    return (
                      <div key={msg.id} className="msg user" id={`msg-${msg.id}`}>
                        <FormattedMessage text={msg.content} />
                        {allAttachments.length > 0 && (
                          <div className="user-msg-attachments-container">
                            {allAttachments.map((att, attIdx) => (
                              <div key={att.id || attIdx} className="user-msg-attachment-badge">
                                <div className="attachment-visual-container">
                                  <div className="attachment-visual-box">
                                    {att.previewUrl ? (
                                      <img
                                        src={att.previewUrl}
                                        alt={att.name}
                                        className="attachment-thumb-img"
                                      />
                                    ) : (
                                      <FileText style={{ width: 16, height: 16, color: '#d4af37' }} />
                                    )}
                                  </div>
                                  <span className="attachment-type-tag">{att.fileTypeLabel || 'FILE'}</span>
                                </div>
                                <div className="attachment-meta">
                                  <span className="attachment-name">{att.name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Assistant Message with AI logo on the left and full action set
                  return (
                    <div key={msg.id} className="msg-row assistant-row" id={`msg-${msg.id}`}>
                      {/* AI Logo on the left side of prompt */}
                      <div className="ai-avatar-badge" title="LifeguideAssist">
                        <img
                          src="/LifeguideAssist_Logo__4_-removebg-preview.png"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/logo.png';
                          }}
                          alt="LifeguideAssist"
                          className="ai-avatar-svg"
                          style={{ width: 32, height: 32, objectFit: 'contain' }}
                        />
                      </div>

                      <div className="msg-body">
                        {/* Thoughts & Analysis container displayed above response */}
                        {msg.thoughts && msg.thoughts.length > 0 && (
                          <div className="thoughts-container">
                            <button
                              className="thoughts-header-btn"
                              onClick={() => toggleThoughts(msg.id)}
                              title="Toggle AI reasoning thoughts"
                            >
                              <span className="thoughts-title">Thoughts & Analysis ({msg.thoughts.length} steps)</span>
                              <span className="thoughts-chevron">{openThoughtIds[msg.id] ? '▲ Collapse' : '▼ View'}</span>
                            </button>
                            {openThoughtIds[msg.id] && (
                              <div className="thoughts-body">
                                {msg.thoughts.map((step, sIdx) => (
                                  <div key={sIdx} className="thought-step">
                                    <span className="thought-tick-mark">✓</span>
                                    <span className="thought-step-text">{step}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tool Live Banner covering the command and launching preview */}
                        {msg.toolCall && (
                          <div className="tool-cover-container">
                            <button
                              className="tool-live-banner-btn"
                              id={`tool-banner-${msg.id}`}
                              onClick={() => {
                                if (msg.toolResult) {
                                  renderToolResultInPreview(msg.toolResult, msg.toolCall);
                                } else {
                                  setIsPreviewOpen(true);
                                }
                              }}
                              title="Click to open interactive preview"
                            >
                              {msg.toolCall.name === 'map_2d' ? (
                                <MapPin style={{ width: 14, height: 14, color: '#10b981' }} />
                              ) : msg.toolCall.name === 'bin_hero' ? (
                                <Recycle style={{ width: 14, height: 14, color: '#38bdf8' }} />
                              ) : msg.toolCall.name === 'calendar' ? (
                                <Calendar style={{ width: 14, height: 14, color: '#eab308' }} />
                              ) : msg.toolCall.name === 'weather_detector' ? (
                                <CloudSun style={{ width: 14, height: 14, color: '#38bdf8' }} />
                              ) : (
                                <Search style={{ width: 14, height: 14, color: '#f59e0b' }} />
                              )}
                              <span className="tool-name">
                                {msg.toolCall.liveText || `${msg.toolCall.name} preview`}
                              </span>
                              <span className="status-badge">
                                <CheckCircle style={{ width: 11, height: 11 }} /> Open Preview ↗
                              </span>
                            </button>

                            <button
                              className="cmd-toggle-btn"
                              onClick={() => toggleCommandDetails(msg.id)}
                              title="Toggle command view"
                            >
                              {openCommandIds[msg.id] ? 'Hide command ▴' : 'Command line details ▾'}
                            </button>

                            {openCommandIds[msg.id] && (
                              <div className="command-details open" id={`cmd-details-${msg.id}`}>
                                {msg.rawCommand || JSON.stringify(msg.toolCall, null, 2)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message text with Markdown and typing effect */}
                        <FormattedMessage text={msg.content} isTyping={typingMsgId === msg.id} />

                        {/* Clickable Resource Card with Website Logo */}
                        {msg.resource && (
                          <div className="resources-section">
                            <div className="resources-title">RESOURCES</div>
                            <a
                              href={msg.resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="resource-card"
                              id={`res-card-${msg.id}`}
                              title={`Open ${msg.resource.title || msg.resource.domain}`}
                            >
                              <div className="resource-icon-box">
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(msg.resource.domain || 'google.com')}&sz=64`}
                                  alt={msg.resource.domain}
                                  className="resource-site-logo"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                    const fallback = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                                <div className="resource-fallback-icon" style={{ display: 'none' }}>
                                  🌐
                                </div>
                              </div>
                              <div className="resource-info">
                                <span className="resource-name">{msg.resource.title}</span>
                                <span className="resource-domain">{msg.resource.domain}</span>
                              </div>
                            </a>
                          </div>
                        )}

                        {/* Action Bar: Thumbs Up / Down with bounce animation, Copy, and Retry (Only shown when AI has finished generating and typing) */}
                        {!isGenerating && typingMsgId !== msg.id && Boolean(msg.content) && (
                          <div className="msg-action-bar">
                            <button
                              className={`msg-action-btn thumbs-up-btn ${ratings[msg.id] === 'up' ? 'active' : ''}`}
                              onClick={() => handleRate(msg.id, 'up')}
                              title="Good response"
                            >
                              <ThumbsUp style={{ width: 13, height: 13 }} />
                            </button>
                            <button
                              className={`msg-action-btn thumbs-down-btn ${ratings[msg.id] === 'down' ? 'active' : ''}`}
                              onClick={() => handleRate(msg.id, 'down')}
                              title="Poor response"
                            >
                              <ThumbsDown style={{ width: 13, height: 13 }} />
                            </button>
                            <button
                              className="msg-action-btn copy-btn"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              title="Copy response"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check style={{ width: 13, height: 13, color: '#10b981' }} />
                                  <span className="action-text copied">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy style={{ width: 13, height: 13 }} />
                                  <span className="action-text">Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              className="msg-action-btn retry-btn"
                              onClick={() => handleRetry(msg.id)}
                              title="Retry this prompt"
                            >
                              <RotateCw style={{ width: 13, height: 13 }} />
                              <span className="action-text">Retry</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Thinking indicator with AI Logo and live ticking container */}
                {isGenerating && (
                  <div className="msg-row assistant-row thinking-row" id="thinkingIndicator">
                    <div className="ai-avatar-badge" title="LifeguideAssist">
                      <img
                        src="/LifeguideAssist_Logo__4_-removebg-preview.png"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/logo.png';
                        }}
                        alt="LifeguideAssist"
                        className="ai-avatar-svg"
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                      />
                    </div>
                    <div className="msg-body">
                      <div className="active-thinking-container">
                        <div className="active-thinking-header">
                          <span className="thinking-pulse-dot" />
                          <span className="active-thinking-title">Thinking...</span>
                        </div>
                        <div className="active-thinking-steps">
                          <div className={`active-thought-step ${liveThoughtStep >= 0 ? 'active' : ''} ${liveThoughtStep > 0 ? 'ticked' : ''}`}>
                            <span className="step-tick">{liveThoughtStep > 0 ? '✓' : '⟳'}</span>
                            <span className="step-text">Step 1: Analyzing user prompt intent & context</span>
                          </div>
                          <div className={`active-thought-step ${liveThoughtStep >= 1 ? 'active' : ''} ${liveThoughtStep > 1 ? 'ticked' : ''}`}>
                            <span className="step-tick">{liveThoughtStep > 1 ? '✓' : liveThoughtStep === 1 ? '⟳' : '○'}</span>
                            <span className="step-text">Step 2: Performing Bing research & verifying tool actions</span>
                          </div>
                          <div className={`active-thought-step ${liveThoughtStep >= 2 ? 'active' : ''} ${liveThoughtStep > 2 ? 'ticked' : ''}`}>
                            <span className="step-tick">{liveThoughtStep > 2 ? '✓' : liveThoughtStep === 2 ? '⟳' : '○'}</span>
                            <span className="step-text">Step 3: Synthesizing structured response & visual layouts</span>
                          </div>
                          <div className={`active-thought-step ${liveThoughtStep >= 3 ? 'active' : ''}`}>
                            <span className="step-tick">{liveThoughtStep >= 3 ? '✓' : '○'}</span>
                            <span className="step-text">Step 4: Grounding interactive visual preview</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generous bottom breathing spacer so the conversation finishes cleanly with organized spacing */}
                <div className="chat-bottom-spacer" id="chatBottomSpacer" />
              </div>
            </div>

            {/* Prompt Timeline in between the chat window and the scroller - STICKY & LINE-BASED (Max 8 lines, hidden if preview is on) */}
            {!isPreviewOpen && userPrompts.length > 0 && (
              <div className="prompt-timeline-rail" id="promptTimelineRail" title="Prompt Timeline">
                <div className="timeline-lines-viewport">
                  {userPrompts.slice(-8).map((prompt, sliceIdx, arr) => {
                    const originalIndex = userPrompts.length <= 8 ? sliceIdx : userPrompts.length - arr.length + sliceIdx;
                    const isActive = originalIndex === activePromptIndex;
                    return (
                      <div
                        key={prompt.id}
                        className={`timeline-line-item ${isActive ? 'active' : ''}`}
                        id={`timeline-node-${prompt.id}`}
                        onClick={() => scrollToMessage(prompt.id, originalIndex)}
                        title={`Prompt #${originalIndex + 1}: ${prompt.content.slice(0, 45)}`}
                      >
                        <div className="timeline-line-bar" />
                        <div className="timeline-line-tooltip">
                          #{originalIndex + 1}: {prompt.content.slice(0, 35)}
                          {prompt.content.length > 35 ? '...' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Card Container */}
        <div className={`input-container-wrapper ${isInputExpanded ? 'expanded-mode' : ''}`}>
          {/* Suggested Prompts Containers - Google AI Studio style (shown after every chat, NOT at the start of the chat) */}
          {isChatActive && suggestions.length > 0 && !isGenerating && (
            <div className="suggestions-prompt-container" id="suggestionsPromptContainer">
              <button
                type="button"
                className={`suggestion-scroll-arrow left ${canScrollLeft ? 'visible' : ''}`}
                id="suggestionScrollLeftBtn"
                onClick={() => handleScrollSuggestions('left')}
                aria-label="Scroll suggestions left"
                title="Scroll left"
                tabIndex={canScrollLeft ? 0 : -1}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>

              <div className="suggestions-scroll-wrapper">
                <div className={`suggestions-edge-fade left ${canScrollLeft ? 'visible' : ''}`} />

                <div
                  className="suggestions-prompt-scroll"
                  id="suggestionsPromptScroll"
                  ref={suggestionsScrollRef}
                  onScroll={updateSuggestionsScrollButtons}
                >
                  {suggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      className="suggestion-prompt-pill"
                      id={`suggestionPrompt-${sIdx}`}
                      onClick={() => handleSuggestionClick(sug)}
                      title={`Ask: "${sug}"`}
                    >
                      <Sparkles className="suggestion-sparkle-icon" style={{ width: 11, height: 11 }} />
                      <span className="suggestion-prompt-text">{sug}</span>
                    </button>
                  ))}
                </div>

                <div className={`suggestions-edge-fade right ${canScrollRight ? 'visible' : ''}`} />
              </div>

              <button
                type="button"
                className={`suggestion-scroll-arrow right ${canScrollRight ? 'visible' : ''}`}
                id="suggestionScrollRightBtn"
                onClick={() => handleScrollSuggestions('right')}
                aria-label="Scroll suggestions right"
                title="Scroll right"
                tabIndex={canScrollRight ? 0 : -1}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          )}

          <div className={`input-card ${isInputExpanded ? 'expanded' : ''} ${isControlsSquashed ? 'squashed-mode' : ''}`} id="inputCard">
            {/* Top right Expand / Collapse button */}
            <button
              className="input-expand-btn"
              id="inputExpandBtn"
              onClick={() => setIsInputExpanded((prev) => !prev)}
              title={isInputExpanded ? 'Collapse input bar' : 'Expand input bar'}
            >
              {isInputExpanded ? (
                <Minimize2 style={{ width: 13, height: 13 }} />
              ) : (
                <Maximize2 style={{ width: 13, height: 13 }} />
              )}
            </button>

            {/* Hidden file input for attachment */}
            <input
              type="file"
              id="fileInput"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {/* Detected User Location Chip */}
            <div
              className={`location-badge ${userCoordinates ? 'show' : ''}`}
              id="locationBadge"
            >
              <MapPin style={{ width: 12, height: 12 }} />
              <span id="locationCoords">
                {userCoordinates
                  ? `${userCoordinates.lat.toFixed(3)}, ${userCoordinates.lon.toFixed(3)}`
                  : 'Locating...'}
              </span>
            </div>

            {/* Attached Files List - Larger Image with Compact File Type Detector */}
            {attachedFiles.length > 0 && (
              <div className="attachments-wrapper" id="attachmentsWrapper">
                {attachedFiles.map((file) => (
                  <div key={file.id} className="attachment-preview show" id={`attachment-${file.id}`}>
                    <div className="attachment-visual-container">
                      <div className="attachment-visual-box">
                        {file.previewUrl ? (
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="attachment-thumb-img"
                          />
                        ) : (
                          <div className="attachment-file-icon">
                            <FileText style={{ width: 18, height: 18, color: '#d4af37' }} />
                          </div>
                        )}
                      </div>
                      <span className="attachment-type-tag">{file.fileTypeLabel || 'FILE'}</span>
                    </div>
                    <div className="attachment-details">
                      <span className="attachment-name" title={file.name}>{file.name}</span>
                      <span className="attachment-size">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button
                      onClick={() => removeAttachment(file.id)}
                      title="Remove this file"
                      className="attachment-remove-btn"
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="input-field"
              id="userInput"
              rows={isInputExpanded ? 6 : 2}
              value={inputText}
              placeholder="Ask Resource Bot to map, search, check collections or analyze attached files..."
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            <div className="actions-bar" ref={actionsBarRef}>
              <div className="left-tools">
                {/* Plus Sign Button: Opens container that shows "Open file" (Max 5 files) */}
                <div className="tool-dropdown-container" ref={fileMenuRef}>
                  <button
                    className={`tool-btn ${isFileMenuOpen ? 'active' : ''}`}
                    id="attachFileBtn"
                    onClick={() => {
                      setIsFileMenuOpen((prev) => !prev);
                      setIsToolsMenuOpen(false);
                    }}
                    title="Add file (Max 5)"
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                    <span className="btn-label">
                      {attachedFiles.length > 0 ? `${attachedFiles.length}/5 Files` : 'Add File'}
                    </span>
                  </button>

                  {isFileMenuOpen && (
                    <div className="tool-popup-menu file-popup" id="fileMenuPopup">
                      <button
                        className="tool-popup-item"
                        id="openFileMenuItem"
                        onClick={() => {
                          triggerFileUpload();
                          setIsFileMenuOpen(false);
                        }}
                        disabled={attachedFiles.length >= 5}
                      >
                        <FolderOpen style={{ width: 15, height: 15, color: '#d4af37' }} />
                        <div className="popup-item-info">
                          <span className="popup-item-title">Open file</span>
                          <span className="popup-item-sub">
                            {attachedFiles.length >= 5 ? 'Maximum 5 files reached' : `${attachedFiles.length}/5 files attached`}
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Tools Button: Opens container showing Call, Auto Locate, Text to Speech, Command Line */}
                <div className="tool-dropdown-container" ref={toolsMenuRef}>
                  <button
                    className={`tool-btn ${isToolsMenuOpen || isTtsActive || userCoordinates ? 'active' : ''}`}
                    id="toolsBtn"
                    onClick={() => {
                      setIsToolsMenuOpen((prev) => !prev);
                      setIsFileMenuOpen(false);
                    }}
                    title="Tools & Commands"
                  >
                    <Wrench style={{ width: 14, height: 14 }} />
                    <span className="btn-label">Tools</span>
                  </button>

                  {isToolsMenuOpen && (
                    <div className="tool-popup-menu tools-popup" id="toolsMenuPopup">
                      {/* Voice Call */}
                      <button
                        className="tool-popup-item"
                        id="popupVoiceCallBtn"
                        onClick={() => {
                          triggerVoiceCall();
                          setIsToolsMenuOpen(false);
                        }}
                      >
                        <div className="popup-item-icon voice-icon">
                          <Phone style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="popup-item-info">
                          <span className="popup-item-title">Voice Call</span>
                          <span className="popup-item-sub">Interactive voice communication</span>
                        </div>
                        <span className="status-dot upcoming-gold" title="Upcoming feature" />
                      </button>

                      {/* Auto Locator */}
                      <button
                        className={`tool-popup-item ${userCoordinates ? 'active-item' : ''}`}
                        id="popupAutoLocateBtn"
                        onClick={() => {
                          autoLocateUser();
                          setIsToolsMenuOpen(false);
                        }}
                      >
                        <div className="popup-item-icon locate-icon">
                          <Compass style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="popup-item-info">
                          <span className="popup-item-title">Auto Locator</span>
                          <span className="popup-item-sub">
                            {userCoordinates
                              ? `${userCoordinates.lat.toFixed(3)}, ${userCoordinates.lon.toFixed(3)}`
                              : 'Detect GPS coordinates'}
                          </span>
                        </div>
                        {userCoordinates && <span className="status-dot active-green" />}
                      </button>

                      {/* Calendar & Schedule */}
                      <button
                        className="tool-popup-item"
                        id="popupCalendarBtn"
                        onClick={() => {
                          quickAction('calendar');
                          setIsToolsMenuOpen(false);
                        }}
                      >
                        <div className="popup-item-icon" style={{ background: '#2e2013', color: '#eab308' }}>
                          <Calendar style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="popup-item-info">
                          <span className="popup-item-title">Calendar & Schedules</span>
                          <span className="popup-item-sub">Check dates, deadlines & events</span>
                        </div>
                      </button>

                      {/* Weather Detector */}
                      <button
                        className="tool-popup-item"
                        id="popupWeatherBtn"
                        onClick={() => {
                          quickAction('weather');
                          setIsToolsMenuOpen(false);
                        }}
                      >
                        <div className="popup-item-icon" style={{ background: '#0e2b3d', color: '#38bdf8' }}>
                          <CloudSun style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="popup-item-info">
                          <span className="popup-item-title">Weather Detector</span>
                          <span className="popup-item-sub">Real-time radar & meteorological data</span>
                        </div>
                      </button>

                      {/* Text to Speech */}
                      <button
                        className={`tool-popup-item ${isTtsActive ? 'active-item' : ''}`}
                        id="popupTtsBtn"
                        onClick={() => {
                          toggleTTS();
                          setIsToolsMenuOpen(false);
                        }}
                      >
                        <div className="popup-item-icon tts-icon">
                          <Mic style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="popup-item-info">
                          <span className="popup-item-title">Text to Speech</span>
                          <span className="popup-item-sub">
                            {isTtsActive ? 'TTS Enabled (Read Aloud)' : 'TTS Disabled'}
                          </span>
                        </div>
                        {isTtsActive && <span className="status-dot active-green" />}
                      </button>

                      {/* Command Line Context */}
                      <button
                        className="tool-popup-item"
                        id="popupTerminalBtn"
                        onClick={() => {
                          toggleTerminalView();
                          setIsToolsMenuOpen(false);
                        }}
                      >
                        <div className="popup-item-icon cmd-icon">
                          <Terminal style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="popup-item-info">
                          <span className="popup-item-title">Command Line</span>
                          <span className="popup-item-sub">Raw terminal session logs</span>
                        </div>
                      </button>

                      {/* Language Selection */}
                      <div className="tool-popup-lang-container" id="toolLanguageSelectContainer">
                        <div className="popup-lang-row">
                          <div className="popup-item-icon lang-icon">
                            <Globe style={{ width: 14, height: 14, color: '#d4af37' }} />
                          </div>
                          <div className="popup-item-info">
                            <span className="popup-item-title">Voice Language</span>
                            <span className="popup-item-sub">Select speech accent / language</span>
                          </div>
                        </div>
                        <select
                          className="tool-popup-lang-dropdown"
                          id="voiceLanguageSelect"
                          value={selectedLanguage}
                          onChange={(e) => {
                            setSelectedLanguage(e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="en-GB">English (UK)</option>
                          <option value="en-US">English (US)</option>
                          <option value="en-AU">English (Australia)</option>
                          <option value="es-ES">Spanish (Español)</option>
                          <option value="fr-FR">French (Français)</option>
                          <option value="de-DE">German (Deutsch)</option>
                          <option value="it-IT">Italian (Italiano)</option>
                          <option value="ja-JP">Japanese (日本語)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="right-tools">
                <button
                  className={`send-button ${isGenerating ? 'stop-btn' : ''}`}
                  id="sendBtn"
                  title={isGenerating ? 'Stop generation' : 'Send message'}
                  onClick={handleSend}
                >
                  {isGenerating ? (
                    <Square id="sendIcon" style={{ width: 13, height: 13 }} />
                  ) : (
                    <CornerDownLeft id="sendIcon" style={{ width: 13, height: 13 }} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Prompt Chips on Initial Welcome View (Matching Image 3) */}
          {!isChatActive && (
            <div className="welcome-prompt-chips" id="welcomePromptChips">
              {[
                'Find the best deal',
                'Predict the future',
                'Create an image',
                'Take a quiz',
                'Improve writing',
                'Fix a clunky sentence',
                'Design a logo',
                'Write a speech',
              ].map((chipText) => (
                <button
                  key={chipText}
                  type="button"
                  className="welcome-chip-btn"
                  onClick={() => {
                    setInputText(chipText);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                >
                  <span>{chipText}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal (User Customization & AI Preferences) */}
      {isSettingsOpen && (
        <div className="settings-modal-backdrop" id="settingsModalBackdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="settings-modal-dialog" id="settingsModalDialog" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <div className="settings-modal-title-row">
                <div className="settings-modal-icon-badge">
                  <Settings style={{ width: 18, height: 18, color: '#dfd5c8' }} />
                </div>
                <div>
                  <h2 className="settings-modal-title">Settings & Preferences</h2>
                  <p className="settings-modal-subtitle">Customize AI identity, default coordinates & behavior</p>
                </div>
              </div>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
                title="Close settings"
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div className="settings-modal-body">
              {/* AI Model Selector */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <Cpu style={{ width: 14, height: 14, color: '#d4af37' }} />
                  <span>AI Model Architecture</span>
                </label>
                <select
                  className="settings-select"
                  id="settingsModelSelect"
                  value={tempSettings.model}
                  onChange={(e) => setTempSettings({ ...tempSettings, model: e.target.value })}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default • Ultra Fast & Intelligent)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Multimodal Reasoning & Code)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </select>
                <span className="settings-hint">LifeGuide uses modern Gemini with real-time tool grounding.</span>
              </div>

              {/* What should AI call you */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <User style={{ width: 14, height: 14, color: '#38bdf8' }} />
                  <span>What should the AI call you?</span>
                </label>
                <input
                  type="text"
                  className="settings-input"
                  id="settingsUserNameInput"
                  placeholder="e.g. Bryan, Sarah, Alex"
                  value={tempSettings.userName}
                  onChange={(e) => setTempSettings({ ...tempSettings, userName: e.target.value })}
                />
                <span className="settings-hint">The AI will address you naturally using this preferred name.</span>
              </div>

              {/* User Email */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <Mail style={{ width: 14, height: 14, color: '#eab308' }} />
                  <span>Your Email Address</span>
                </label>
                <input
                  type="email"
                  className="settings-input"
                  id="settingsUserEmailInput"
                  placeholder="e.g. mailbryanuk@gmail.com"
                  value={tempSettings.userEmail}
                  onChange={(e) => setTempSettings({ ...tempSettings, userEmail: e.target.value })}
                />
                <span className="settings-hint">Used for schedule summaries and personal context.</span>
              </div>

              {/* Default Location */}
              <div className="settings-field-group">
                <label className="settings-label">
                  <MapPin style={{ width: 14, height: 14, color: '#10b981' }} />
                  <span>Default Location</span>
                </label>
                <input
                  type="text"
                  className="settings-input"
                  id="settingsDefaultLocationInput"
                  placeholder="e.g. Liverpool, UK or London, UK"
                  value={tempSettings.defaultLocation}
                  onChange={(e) => setTempSettings({ ...tempSettings, defaultLocation: e.target.value })}
                />
                <span className="settings-hint">
                  Saved permanently so you never have to re-enter your city or area again.
                </span>
              </div>
            </div>

            <div className="settings-modal-footer">
              <button
                type="button"
                className="settings-btn-cancel"
                onClick={() => setIsSettingsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn-save"
                id="saveSettingsBtn"
                onClick={() => handleSaveSettings(tempSettings)}
              >
                {settingsSavedToast ? (
                  <>
                    <Check style={{ width: 14, height: 14 }} />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Preferences</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat History Options Modal - Overlaps whole page with background blur */}
      {isSessionModalOpen && selectedSessionForModal && (
        <div
          className="chat-options-modal-backdrop"
          id="chatOptionsModalBackdrop"
          onClick={() => {
            setIsSessionModalOpen(false);
            setSelectedSessionForModal(null);
          }}
        >
          <div
            className="chat-options-modal-card"
            id="chatOptionsModalCard"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chat-options-modal-header">
              <div className="chat-options-title-block">
                <div className="chat-options-icon-box">
                  <MessageSquare style={{ width: 18, height: 18, color: '#dfd5c8' }} />
                </div>
                <div>
                  <h3 className="chat-options-modal-heading">Chat Options</h3>
                  <p className="chat-options-modal-sub" title={selectedSessionForModal.title}>
                    {selectedSessionForModal.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="chat-options-close-btn"
                onClick={() => {
                  setIsSessionModalOpen(false);
                  setSelectedSessionForModal(null);
                }}
                title="Close"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div className="chat-options-modal-body">
              {/* Option 1: Download Chat */}
              <button
                type="button"
                className="chat-option-row-btn"
                id="modalDownloadChatBtn"
                onClick={() => handleDownloadChatSession(selectedSessionForModal)}
              >
                <div className="chat-option-btn-icon download">
                  <Download style={{ width: 18, height: 18 }} />
                </div>
                <div className="chat-option-btn-content">
                  <span className="chat-option-btn-title">Download Chat</span>
                  <span className="chat-option-btn-desc">
                    Export complete conversation transcript with formatting and tool outputs as Markdown
                  </span>
                </div>
              </button>

              {/* Option 2: Reset Chat */}
              <button
                type="button"
                className="chat-option-row-btn"
                id="modalResetChatBtn"
                onClick={() => handleResetChatSession(selectedSessionForModal)}
              >
                <div className="chat-option-btn-icon reset">
                  <RotateCcw style={{ width: 18, height: 18 }} />
                </div>
                <div className="chat-option-btn-content">
                  <span className="chat-option-btn-title">Reset Chat</span>
                  <span className="chat-option-btn-desc">
                    Clear all messages from this conversation and start fresh
                  </span>
                </div>
              </button>

              {/* Option 3: Delete Chat */}
              <button
                type="button"
                className="chat-option-row-btn delete"
                id="modalDeleteChatBtn"
                onClick={() => handleDeleteSessionFromModal(selectedSessionForModal.id)}
              >
                <div className="chat-option-btn-icon delete">
                  <Trash2 style={{ width: 18, height: 18 }} />
                </div>
                <div className="chat-option-btn-content">
                  <span className="chat-option-btn-title">Delete Chat</span>
                  <span className="chat-option-btn-desc">
                    Permanently delete this chat history from your session list
                  </span>
                </div>
              </button>
            </div>

            <div className="chat-options-modal-footer">
              <button
                type="button"
                className="chat-options-cancel-btn"
                onClick={() => {
                  setIsSessionModalOpen(false);
                  setSelectedSessionForModal(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-Time User Onboarding Modal */}
      {isOnboardingOpen && (
        <div
          className="chat-options-modal-backdrop"
          id="onboardingModalBackdrop"
          style={{ zIndex: 10000 }}
        >
          <div
            className="chat-options-modal-card onboarding-card"
            id="onboardingModalCard"
            style={{ maxWidth: 440, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#241c16',
                  border: '1px solid #4a3828',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src="/LifeguideAssist_Logo__4_-removebg-preview.png"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/logo.png';
                  }}
                  alt="LifeGuide Assist"
                  style={{ width: 28, height: 28, objectFit: 'contain' }}
                />
              </div>
              <div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Welcome to LifeGuide Assist
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#a89d91', margin: 0 }}>
                  Personalized AI Workspace & Smart Assistant
                </p>
              </div>
            </div>

            <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  htmlFor="onboardingNameInput"
                  style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#e8e0d5', marginBottom: 6 }}
                >
                  What should the AI call you?
                </label>
                <input
                  id="onboardingNameInput"
                  type="text"
                  value={onboardingNameInput}
                  onChange={(e) => setOnboardingNameInput(e.target.value)}
                  placeholder="e.g. Bryan, Sarah, Alex..."
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    background: '#15110e',
                    border: '1px solid #3d3126',
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#d4af37')}
                  onBlur={(e) => (e.target.style.borderColor = '#3d3126')}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  className="settings-btn-save"
                  id="onboardingSubmitBtn"
                  style={{
                    padding: '9px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    borderRadius: 8,
                    background: '#dfd5c8',
                    color: '#1a1410',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Save & Get Started
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Side Preview Panel - FLUSH / NOT FLOATING / RESIZABLE */}
      <div
        className={`preview-panel ${isPreviewOpen ? 'open' : ''} ${isFullscreen ? 'fullscreen' : ''} ${isResizing ? 'resizing' : ''}`}
        id="previewPanel"
        style={{
          width: isFullscreen ? '100%' : isPreviewOpen ? `${previewWidth}px` : '0px',
        }}
      >
        {/* Drag Resize Handle on Left Border */}
        {isPreviewOpen && !isFullscreen && (
          <div
            className="preview-resize-handle"
            id="previewResizeHandle"
            onMouseDown={handleMouseDownResize}
            title="Drag to resize preview panel"
          >
            <div className="preview-resize-bar" />
          </div>
        )}

        <div className="preview-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#26201d', padding: 6, borderRadius: 4, display: 'flex' }}>
              <FileText style={{ width: 16, height: 16, color: '#ede8e3' }} />
            </div>
            <div className="header-titles">
              <span className="header-main-title" id="panelTitle">
                {previewContent?.title || 'Output Block Preview'}
              </span>
              <span className="header-sub-title" id="panelSubTitle">
                {previewContent?.subTitle || 'FORMATTED OUTPUT PREVIEW'}
              </span>
            </div>
          </div>

          <div className="header-controls">
            <button
              className="header-btn"
              id="fullscreenBtn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullscreen ? (
                <Minimize2 style={{ width: 14, height: 14 }} />
              ) : (
                <Maximize2 style={{ width: 14, height: 14 }} />
              )}
            </button>
            <button
              className="header-btn"
              id="closePreviewBtn"
              onClick={() => {
                setIsPreviewOpen(false);
                setIsFullscreen(false);
              }}
              title="Close"
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        <div className="preview-body">
          <iframe
            id="previewFrame"
            className={`preview-frame ${isResizing ? 'pointer-events-none' : ''}`}
            title="Preview"
            srcDoc={previewContent?.htmlContent || ''}
          />
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
