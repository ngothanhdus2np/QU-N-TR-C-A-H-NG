import { useEffect, useRef, useState } from 'react';

const SHOW_DELAY_MS = 220;
const MIN_VISIBLE_MS = 300;
const LINE_HEIGHT = 16;

export function SlidingLabel({ text, lineHeight = LINE_HEIGHT, fontSize = 14, color = '#9ca3af' }: { text: string; lineHeight?: number; fontSize?: number; color?: string }) {
  const [current, setCurrent] = useState(text);
  const [next, setNext] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (text === current && !animating) return;
    if (text === current) { pendingRef.current = null; return; }

    if (animating) {
      // Đang animate → ghi nhớ, chờ xong rồi mới chạy tiếp
      pendingRef.current = text;
      return;
    }

    setNext(text);
    // Đợi 2 frame để DOM render next trước khi bật transition
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
  }, [text]);

  const handleTransitionEnd = () => {
    const queued = pendingRef.current;
    pendingRef.current = null;
    setCurrent(next!);
    setNext(null);
    setAnimating(false);

    if (queued && queued !== next) {
      // Có text đang chờ → trigger lại cycle kế
      setTimeout(() => {
        setNext(queued);
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      }, 0);
    }
  };

  return (
    <div style={{ height: lineHeight, overflow: 'hidden', position: 'relative', minWidth: 1 }}>
      <div
        style={{
          transform: animating ? `translateY(-${lineHeight}px)` : 'translateY(0)',
          transition: animating ? 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div style={{ height: lineHeight, whiteSpace: 'nowrap', lineHeight: `${lineHeight}px`, fontSize, color }}>
          {current}
        </div>
        {next !== null && (
          <div style={{ height: lineHeight, whiteSpace: 'nowrap', lineHeight: `${lineHeight}px`, fontSize, color }}>
            {next}
          </div>
        )}
      </div>
    </div>
  );
}

interface AppLoadingScreenProps {
  visible: boolean;
  stageLabel?: string | null;
  brandName?: string;
}

export default function AppLoadingScreen({
  visible,
  stageLabel,
  brandName = 'Phúc Sang',
}: AppLoadingScreenProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShouldRender(true);
      }, SHOW_DELAY_MS);
    } else {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (shouldRender) {
        const elapsed = Date.now() - (shownAtRef.current || Date.now());
        const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
        hideTimerRef.current = setTimeout(() => setShouldRender(false), remaining);
      } else {
        setShouldRender(false);
      }
    }
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <span style={{ fontWeight: 600, color: '#dc2626', letterSpacing: '0.01em' }}>
          {brandName}
        </span>
        {stageLabel && (
          <>
            <span style={{ width: 1, height: 13, background: '#e5e7eb', display: 'inline-block' }} />
            <SlidingLabel text={stageLabel} />
          </>
        )}
      </div>
    </div>
  );
}
