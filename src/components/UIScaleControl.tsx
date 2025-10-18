import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'ui_scale_override';

export default function UIScaleControl() {
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setScale(Number(raw));
    } catch {
      // noop
    }
  }, []);

  const apply = (s: number | null) => {
    try {
      if (s === null) {
        localStorage.removeItem(STORAGE_KEY);
        setScale(null);
      } else {
        localStorage.setItem(STORAGE_KEY, String(s));
        setScale(s);
      }
      // apply to root font-size
      if (s === null) {
        document.documentElement.style.fontSize = '';
      } else {
        document.documentElement.style.fontSize = `${s}%`;
      }
    } catch {
      // noop
    }
  };

  const increase = () => apply((scale ?? 100) + 5);
  const decrease = () => apply(Math.max(50, (scale ?? 100) - 5));
  const reset = () => apply(null);

  // show control only on narrow screens
  const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  if (!isMobile) return null;

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9999 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,0.9)', padding: 6, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
        <button onClick={decrease} aria-label="Diminuir UI" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #eee' }}>-5%</button>
        <div style={{ minWidth: 52, textAlign: 'center', fontSize: 13 }}>{(scale ?? parseInt(getComputedStyle(document.documentElement).fontSize || '16') ) ? (scale ?? 100) + '%' : 'auto'}</div>
        <button onClick={increase} aria-label="Aumentar UI" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #eee' }}>+5%</button>
        <button onClick={reset} aria-label="Resetar escala" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #eee' }}>reset</button>
      </div>
    </div>
  );
}
