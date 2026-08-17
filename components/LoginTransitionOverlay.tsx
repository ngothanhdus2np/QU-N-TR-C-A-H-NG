import React, { useState, useEffect, useRef } from 'react';
import { SlidingLabel } from './AppLoadingScreen';

const FEATURES = ['POS bán hàng', 'Báo cáo tài chính', 'Phân tích AI', 'Kết nối đa nền tảng'];
const FEATURE_INTERVAL_MS = 1800;
const TOTAL_ROUNDS = 2;
// 4 features × 2 vòng × 1800ms = 14400ms → lúc này card vừa kín màn hình
const EXPAND_MS = FEATURES.length * TOTAL_ROUNDS * FEATURE_INTERVAL_MS;

type Phase = 'hidden' | 'content' | 'expanding' | 'sliding';
type NavigateFn = () => void;

let _trigger: ((navigate: NavigateFn) => void) | null = null;

export function triggerCashierTransition(navigate: NavigateFn) {
  _trigger?.(navigate);
}

export default function LoginTransitionOverlay() {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [featureLabel, setFeatureLabel] = useState(FEATURES[0]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startRef = useRef<(navigate: NavigateFn) => void>(null!);

  startRef.current = (navigate: NavigateFn) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setFeatureLabel(FEATURES[0]);
    setPhase('content');

    // t=50ms   : bắt đầu expand đồng thời với cycling (CSS 14.4s linear)
    // t=14450ms: expand xong → navigate + slide lên
    // t=15150ms: ẩn overlay
    const t0 = setTimeout(() => setPhase('expanding'), 50);
    const t1 = setTimeout(() => { navigate(); setPhase('sliding'); }, 50 + EXPAND_MS);
    const t2 = setTimeout(() => setPhase('hidden'), 50 + EXPAND_MS + 700);

    timersRef.current = [t0, t1, t2];
  };

  useEffect(() => {
    _trigger = (nav) => startRef.current(nav);
    return () => {
      _trigger = null;
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Cycling chạy suốt cả content lẫn expanding — dừng khi slide/hidden
  const shouldCycle = phase === 'content' || phase === 'expanding';
  useEffect(() => {
    if (!shouldCycle) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % FEATURES.length;
      setFeatureLabel(FEATURES[idx]);
    }, FEATURE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shouldCycle]);

  if (phase === 'hidden') return null;

  const vw = window.innerWidth / 100;
  const logoWidth  = Math.round(Math.min(Math.max(vw * 20, 100), 300));
  const fontSize   = Math.round(Math.min(Math.max(vw * 2.2, 16), 36));
  const lineHeight = Math.round(fontSize * 1.5);
  const textWidth  = Math.round(Math.min(Math.max(vw * 24, 140), 400));
  const gap        = Math.round(Math.min(Math.max(vw *  4,  16),  56));
  const divH       = Math.round(Math.min(Math.max(vw *  9,  56), 130));

  const expandS = (EXPAND_MS / 1000).toFixed(1); // '14.4'

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    background: 'white',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: phase === 'sliding'
      ? 'transform 0.7s cubic-bezier(0.4, 0, 1, 1)'
      : `top ${expandS}s linear, left ${expandS}s linear, width ${expandS}s linear, height ${expandS}s linear, border-radius 1.2s ease, box-shadow 0.8s ease`,
    ...(phase === 'content' ? {
      top: '15vh', left: '15vw', width: '70vw', height: '70vh',
      borderRadius: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    } : phase === 'expanding' ? {
      top: 0, left: 0, width: '100vw', height: '100vh',
      borderRadius: 0,
      boxShadow: 'none',
    } : {
      top: 0, left: 0, width: '100vw', height: '100vh',
      borderRadius: 0,
      boxShadow: 'none',
      transform: 'translateY(-100%)',
    }),
  };

  return (
    <div style={overlayStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap }}>
        <img src="/logo.png" style={{ width: logoWidth, objectFit: 'contain' }} alt="Logo cửa hàng" />
        <div style={{ width: 1, height: divH, background: '#e5e7eb', flexShrink: 0 }} />
        <div style={{ width: textWidth }}>
          <SlidingLabel text={featureLabel} lineHeight={lineHeight} fontSize={fontSize} />
        </div>
      </div>
    </div>
  );
}
