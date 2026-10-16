"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";

const GREEN = "#D8FF7A";
const TRAIL = "#8AB84A";
const FADED = "#CFD3DA";

/** เส้น A ··· B มุมการ์ดใกล้ถึงปลุก — แบบ Flutter `_RouteHintBadge` */
export function RouteHint() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let running = true;
    const started = performance.now();
    const cssW = 180;
    const cssH = 28;

    function draw(progress: number) {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const y = cssH * 0.55;
      ctx.font = "700 14px var(--font-prompt), Prompt, sans-serif";
      ctx.fillStyle = GREEN;
      ctx.textBaseline = "middle";
      ctx.fillText("A", 0, y);
      const aW = ctx.measureText("A").width;

      const dotCount = 5;
      const baseR = 3.4;
      const sideGap = 9;
      const edgeGap = 1.8;
      const radii = Array.from({ length: dotCount }, (_, i) => (i === 2 ? baseR * 2 : baseR));
      let dotsWidth = 0;
      radii.forEach((r, i) => {
        dotsWidth += r * 2;
        if (i < dotCount - 1) dotsWidth += edgeGap;
      });
      const dotsStartX = aW + sideGap;
      const bX = dotsStartX + dotsWidth + sideGap;
      const travelPos = progress * 3;

      let cursorX = dotsStartX;
      for (let i = 0; i < dotCount; i++) {
        const radius = radii[i];
        if (i >= 3) {
          ctx.fillStyle = FADED;
        } else {
          const d = Math.abs(travelPos - i);
          const wrapD = Math.min(d, 3 - d);
          const strength = Math.max(0, Math.min(1, 1 - wrapD / 0.7));
          ctx.fillStyle = lerp(TRAIL, GREEN, strength);
        }
        const cx = cursorX + radius;
        ctx.beginPath();
        ctx.arc(cx, y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (i === 2) {
          ctx.fillStyle = "#2E7D32";
          ctx.beginPath();
          const s = radius * 0.85;
          ctx.moveTo(cx - s * 0.35, y - s);
          ctx.lineTo(cx + s * 0.75, y);
          ctx.lineTo(cx - s * 0.35, y + s);
          ctx.closePath();
          ctx.fill();
        }
        cursorX += radius * 2 + (i < dotCount - 1 ? edgeGap : 0);
      }

      ctx.fillStyle = GREEN;
      ctx.fillText("B", bX, y);
    }

    function loop(now: number) {
      if (!running) return;
      draw(((now - started) / 1800) % 1);
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pointer-events-none">
      <p className="text-[16px] font-semibold leading-tight text-[#D8FF7A]">{t("trackingDistanceShort")}</p>
      <canvas ref={canvasRef} className="mt-2 block" width={180} height={28} aria-hidden />
    </div>
  );
}

function lerp(a: string, b: string, t: number) {
  const pa = hex(a);
  const pb = hex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hex(c: string): [number, number, number] {
  const n = c.replace("#", "");
  return [
    Number.parseInt(n.slice(0, 2), 16),
    Number.parseInt(n.slice(2, 4), 16),
    Number.parseInt(n.slice(4, 6), 16),
  ];
}
