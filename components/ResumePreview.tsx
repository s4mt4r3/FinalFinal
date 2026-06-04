'use client';

// ============================================================
// components/ResumePreview.tsx
// ============================================================
// Live, client-rendered preview of a composed resume that
// auto-fits the content onto a single Letter page.
//
// Because the renderers in lib/resume-render are pure, we render
// the HTML in the browser (no server round-trip per keystroke),
// drop it into an iframe, measure the laid-out height, and shrink
// the font scale until it fits one page (down to a readable floor).
// The chosen scale is reported up via onScale so the parent can
// export at exactly the same size.
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { renderHtml, type Composition } from '@/lib/resume-render';

const PAGE_W = 816; // 8.5in @ 96dpi
const PAGE_H = 1056; // 11in @ 96dpi
const MIN_SCALE = 0.5;

export default function ResumePreview({
  composition,
  width = 460,
  onScale,
  onFit,
}: {
  composition: Composition;
  width?: number;
  onScale?: (scale: number) => void;
  onFit?: (info: { fits: boolean; pages: number; scale: number }) => void;
}) {
  const compKey = useMemo(() => JSON.stringify(composition), [composition]);
  const [scale, setScale] = useState(1);
  const fit = useRef<{ key: string; iters: number }>({ key: '', iters: 0 });

  // New composition → reset and re-fit from full size.
  useEffect(() => {
    fit.current = { key: compKey, iters: 0 };
    setScale(1);
  }, [compKey]);

  const html = useMemo(() => renderHtml(composition, { scale }), [composition, scale]);

  const onLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const doc = e.currentTarget.contentDocument;
    if (!doc?.documentElement) return;
    const contentH = doc.documentElement.scrollHeight; // px at current scale
    const pages = Math.max(1, Math.ceil(contentH / PAGE_H));
    const fits = contentH <= PAGE_H + 2;

    const st = fit.current;
    // Iteratively shrink toward a single page (height ≈ ∝ scale).
    if (st.key === compKey && st.iters < 7) {
      const target = PAGE_H - 8; // leave a hair of breathing room
      if (contentH > target && scale > MIN_SCALE) {
        const next = Math.max(MIN_SCALE, +((scale * target) / contentH).toFixed(3));
        if (next < scale - 0.002) {
          st.iters += 1;
          setScale(next);
          return; // re-render will fire onLoad again
        }
      }
    }
    onScale?.(scale);
    onFit?.({ fits: contentH <= PAGE_H + 2, pages, scale });
  };

  const disp = width / PAGE_W; // display scale to fit the pane

  return (
    <div
      style={{
        width,
        height: PAGE_H * disp,
        position: 'relative',
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 3px 18px -6px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        borderRadius: 2,
      }}
    >
      <iframe
        title="resume-preview"
        srcDoc={html}
        onLoad={onLoad}
        scrolling="no"
        style={{
          width: PAGE_W,
          height: PAGE_H,
          border: 0,
          transform: `scale(${disp})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          background: '#fff',
        }}
      />
    </div>
  );
}
