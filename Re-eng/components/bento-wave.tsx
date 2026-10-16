"use client";

import { useEffect, useRef } from "react";

type BentoWaveProps = {
  color: string;
  animate?: boolean;
  progress?: number;
  topRightToBottomLeft?: boolean;
  cloudLike?: boolean;
  className?: string;
};

function paintWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  color: string,
  topRightToBottomLeft: boolean,
  cloudLike: boolean,
) {
  const strokeWidth = 24;
  const overshoot = strokeWidth * 0.6;
  const startX = w + overshoot;
  const startY = -overshoot;
  const endX = topRightToBottomLeft ? -overshoot : w * 0.52;
  const endY = h + overshoot;
  const dirX = endX - startX;
  const dirY = endY - startY;
  const dirLen = Math.hypot(dirX, dirY);
  if (!dirLen) return;
  const perpX = -dirY / dirLen;
  const perpY = dirX / dirLen;
  const amplitude = cloudLike ? h * 0.4 : h * 0.69;
  const freq = cloudLike ? 3.1 : 2.2;
  const phase = progress * 2 * Math.PI;
  const steps = 320;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const envelope = Math.sin(Math.PI * t);
    const raw = Math.sin(t * freq * 2 * Math.PI + phase);
    const waveValue = cloudLike ? ((raw + 1) / 2) ** 1.35 : raw;
    const offset = envelope * amplitude * waveValue;
    const x = startX + dirX * t + perpX * offset;
    const y = startY + dirY * t + perpY * offset;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** เส้นคลื่นเฉียงแบบการ์ด bento ของแอป Flutter */
export function BentoWave({
  color,
  animate = true,
  progress = 0.2,
  topRightToBottomLeft = false,
  cloudLike = false,
  className = "",
}: BentoWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let running = true;
    const started = performance.now();

    function resizeAndPaint(now: number) {
      if (!canvas || !ctx) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w < 1 || h < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const p = animate ? ((now - started) / 10000) % 1 : progress;
      paintWave(ctx, w, h, p, color, topRightToBottomLeft, cloudLike);
    }

    function loop(now: number) {
      if (!running) return;
      resizeAndPaint(now);
      if (animate) frame = requestAnimationFrame(loop);
    }

    resizeAndPaint(performance.now());
    if (animate) frame = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => resizeAndPaint(performance.now()));
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [animate, color, cloudLike, progress, topRightToBottomLeft]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    />
  );
}
