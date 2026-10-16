"use client";

import { useEffect, useState } from "react";

type Line = { key: string; stroke: string; strokeWidth: number; d: string };

const LINES: Line[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    key: `a-${i}`,
    stroke: "rgba(0,0,0,0.035)",
    strokeWidth: 1,
    d: wavePath(i, 22, 6, 41, 3, -40 + i * 70),
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    key: `b-${i}`,
    stroke: "rgba(74,137,234,0.04)",
    strokeWidth: 0.8,
    d: wavePath(i, 28, 8, 0, 0, -20 + i * 88, true),
  })),
];

/** ลายเส้นโทโพจาง ๆ แบบหน้าสถานที่โปรด / บัญชีของแอป Flutter */
export function TopoPattern({ className = "" }: { className?: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
      preserveAspectRatio="none"
    >
      {ready
        ? LINES.map((line) => (
            <path
              key={line.key}
              fill="none"
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
              d={line.d}
            />
          ))
        : null}
    </svg>
  );
}

function wavePath(
  i: number,
  p1: number,
  a1: number,
  p2: number,
  a2: number,
  base: number,
  cosOnly = false,
) {
  const bits = [`M 0 ${fmt(base)}`];
  const step = cosOnly ? 8 : 6;
  for (let x = 0; x <= 1200; x += step) {
    const y = cosOnly
      ? base + Math.cos(x / p1 + i) * a1
      : base + Math.sin(x / p1 + i * 0.7) * a1 + Math.cos(x / p2) * a2;
    bits.push(`L ${x} ${fmt(y)}`);
  }
  return bits.join(" ");
}

function fmt(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}
