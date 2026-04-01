import React, { useCallback, useState } from 'react';
import { useLocation } from '@docusaurus/router';
import { useDocsSidebar } from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

// ─── Sidebar types ───────────────────────────────────────────────────────────
type DocItem = { type: 'doc'; label: string; href: string };
type CategoryItem = { type: 'category'; label: string; items: AnyItem[]; href?: string };
type AnyItem = DocItem | CategoryItem | { type: string };

function collectDocs(items: AnyItem[]): DocItem[] {
  const result: DocItem[] = [];
  for (const item of items) {
    if (item.type === 'doc') result.push(item as DocItem);
    else if (item.type === 'category') result.push(...collectDocs((item as CategoryItem).items));
  }
  return result;
}

/** Returns the direct parent category that contains the given pathname, plus all its docs. */
function findParentCategory(
  items: AnyItem[],
  pathname: string,
): { label: string; docs: DocItem[] } | null {
  for (const item of items) {
    if (item.type !== 'category') continue;
    const cat = item as CategoryItem;
    const directDocs = cat.items.filter((i) => i.type === 'doc') as DocItem[];
    if (directDocs.some((d) => d.href === pathname)) {
      return { label: cat.label, docs: collectDocs(cat.items) };
    }
    const nested = findParentCategory(cat.items, pathname);
    if (nested) return nested;
  }
  return null;
}

// ─── Print styles injected into the popup window ─────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt; line-height: 1.65; color: #111; background: #fff;
  }
  @page { margin: 2cm 2.5cm; }
  h1 { font-size: 20pt; margin: 0 0 0.4em; }
  h2 { font-size: 15pt; margin: 1.4em 0 0.5em; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 1.1em 0 0.3em; }
  h4, h5 { font-size: 11pt; margin: 0.9em 0 0.3em; }
  p  { margin: 0.55em 0; }
  a  { color: #1d4ed8; }
  ul, ol { padding-left: 1.7em; margin: 0.4em 0; }
  li { margin: 0.15em 0; }
  code {
    font-family: 'Courier New', monospace; font-size: 8.5pt;
    background: #f3f4f6; padding: 1px 5px; border-radius: 3px;
  }
  pre {
    background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px;
    padding: 10px 14px; overflow: hidden; page-break-inside: avoid; margin: 0.8em 0;
  }
  pre code { background: transparent; padding: 0; font-size: 8pt; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; page-break-inside: avoid; }
  th, td { border: 1px solid #d1d5db; padding: 5px 9px; text-align: left; font-size: 10pt; }
  th { background: #f3f4f6; font-weight: 700; }
  blockquote { border-left: 3px solid #9ca3af; padding: 4px 12px; color: #374151; margin: 0.7em 0; }
  details { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 12px; margin: 0.6em 0; }
  summary { font-weight: 600; }
  /* Admonitions */
  .theme-admonition, [class*="admonition"] {
    border-left: 4px solid #6b7280; padding: 8px 12px; margin: 0.8em 0; background: #f9fafb;
  }
  /* Hide anything interactive */
  button, [class*="quizCard"], [class*="Quiz"], [class*="interviewTimer"],
  [class*="progressDashboard"], nav, .pagination-nav, [class*="tableOfContents"],
  [class*="toc"], .breadcrumbs__list { display: none !important; }
  /* Section separators */
  .doc-section { margin-bottom: 2.5em; }
  .doc-section-sep {
    page-break-before: always; border-top: 2px solid #374151;
    margin: 2em 0 1.5em; padding-top: 0.5em;
    font-size: 9pt; color: #6b7280; font-variant: small-caps; letter-spacing: 0.06em;
  }
  /* Cover page */
  .cover {
    height: 95vh; display: flex; flex-direction: column;
    justify-content: center; page-break-after: always;
  }
  .cover-tag   { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 0.6em; }
  .cover-title { font-size: 28pt; font-weight: 900; color: #111; margin-bottom: 0.4em; line-height: 1.1; }
  .cover-meta  { font-size: 10pt; color: #6b7280; margin-top: 2em; }
`;

// ─── Helper: fetch a page and extract article HTML ────────────────────────────
async function fetchArticleHTML(href: string): Promise<{ title: string; html: string }> {
  const res = await fetch(href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const title = doc.querySelector('article h1')?.textContent?.trim() ?? href;
  const content = doc.querySelector('.markdown') ?? doc.querySelector('article');
  if (!content) return { title, html: '<p><em>Contenido no disponible.</em></p>' };
  const clone = content.cloneNode(true) as HTMLElement;
  // Remove elements that shouldn't be in a PDF
  clone
    .querySelectorAll(
      'button, [class*="quizCard"], nav, .pagination-nav, [class*="tableOfContents"]',
    )
    .forEach((el) => el.remove());
  return { title, html: clone.innerHTML };
}

// ─── Open popup, load all pages, trigger print ───────────────────────────────
async function printPages(
  win: Window,
  pages: DocItem[],
  categoryLabel: string,
): Promise<void> {
  const date = new Date().toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const results = await Promise.allSettled(pages.map((p) => fetchArticleHTML(p.href)));

  const sections = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { title: pages[i].label, html: '<p><em>No se pudo cargar esta página.</em></p>' },
  );

  const body = sections
    .map(
      (s, i) =>
        `${i > 0 ? `<div class="doc-section-sep">${categoryLabel}</div>` : ''}
         <div class="doc-section">${s.html}</div>`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${categoryLabel} — Interview Guide</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="cover">
    <div class="cover-tag">Full Stack .NET + React — Interview Guide</div>
    <div class="cover-title">${categoryLabel}</div>
    <div class="cover-meta">${sections.length} páginas · Exportado el ${date}</div>
  </div>
  ${body}
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the browser time to render before printing
  win.addEventListener('load', () => setTimeout(() => win.print(), 400));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExportPDF(): React.ReactElement | null {
  const location = useLocation();
  const sidebar = useDocsSidebar();
  const [loading, setLoading] = useState(false);

  const isDocPage = location.pathname.startsWith('/docs/');
  if (!isDocPage || !sidebar) return null;

  const category = findParentCategory(sidebar.items as AnyItem[], location.pathname);

  // ── Single page export ──
  const handlePageExport = useCallback(() => {
    window.print();
  }, []);

  // ── Category export ──
  const handleCategoryExport = useCallback(async () => {
    if (!category || loading) return;
    // window.open() MUST be called synchronously (during click handler) to avoid popup blocking
    const win = window.open('', '_blank', 'width=960,height=800');
    if (!win) {
      alert('Tu navegador bloqueó la ventana emergente. Permite popups para este sitio.');
      return;
    }
    win.document.write(
      `<html><body style="font-family:sans-serif;padding:3rem;color:#333">
        <p>⏳ Generando PDF con ${category.docs.length} páginas…</p>
       </body></html>`,
    );
    setLoading(true);
    try {
      await printPages(win, category.docs, category.label);
    } finally {
      setLoading(false);
    }
  }, [category, loading]);

  return (
    <div className={styles.container} role="region" aria-label="Exportar como PDF">
      <button
        className={styles.pageBtn}
        onClick={handlePageExport}
        aria-label="Exportar esta página como PDF"
        title="Exportar esta página como PDF"
      >
        <span aria-hidden="true">📄</span>
        <span className={styles.label}>PDF</span>
      </button>

      {category && (
        <button
          className={`${styles.categoryBtn} ${loading ? styles.loading : ''}`}
          onClick={handleCategoryExport}
          disabled={loading}
          aria-label={`Exportar categoría "${category.label}" completa como PDF`}
          title={`Exportar "${category.label}" completa (${category.docs.length} páginas)`}
        >
          <span aria-hidden="true">{loading ? '⏳' : '📚'}</span>
          <span className={styles.label}>
            {loading ? 'Generando…' : `${category.label.replace(/^[^\w]*/, '')} (${category.docs.length}p)`}
          </span>
        </button>
      )}
    </div>
  );
}
