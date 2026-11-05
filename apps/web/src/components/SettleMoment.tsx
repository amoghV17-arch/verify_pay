import React, { useState, useEffect, useRef } from 'react';
import { formatCents } from '@milestone/shared';

export interface SettleEventData {
  milestoneId: string;
  milestoneName: string;
  amountCents: number;
  recipientName?: string;
}

/**
 * useCountUp hook provides high-precision eased numerical counter for monetary displays.
 * Automatically respects prefers-reduced-motion by updating instantaneously.
 */
export function useCountUp(targetValue: number, duration: number = 700): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const prevValueRef = useRef(targetValue);

  useEffect(() => {
    const startValue = prevValueRef.current;
    if (startValue === targetValue) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setDisplayValue(targetValue);
      prevValueRef.current = targetValue;
      return;
    }

    const startTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic curve for smooth settling
      const ease = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startValue + (targetValue - startValue) * ease);
      setDisplayValue(nextVal);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = targetValue;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [targetValue, duration]);

  return displayValue;
}

interface SettleCoinFlyerProps {
  settleData: SettleEventData;
  onComplete: () => void;
}

/**
 * SettleCoinFlyer renders a coin marker that travels along a curved arc
 * from the milestone timeline diamond to the header freelancer balance chip.
 */
export const SettleCoinFlyer: React.FC<SettleCoinFlyerProps> = ({ settleData, onComplete }) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);
  const flyerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    // Locate target (#balance-chip in header)
    const chipEl = document.getElementById('balance-chip');
    const chipRect = chipEl?.getBoundingClientRect() || {
      left: window.innerWidth - 180,
      top: 24,
      width: 120,
      height: 36,
    };
    const targetX = chipRect.left + chipRect.width / 2;
    const targetY = chipRect.top + chipRect.height / 2;

    // Locate milestone diamond in Gantt timeline or use center left fallback
    const milestoneEl =
      document.querySelector(`.milestone-status-paid`) ||
      document.querySelector(`.b-milestone`) ||
      document.querySelector(`.milestone-timeline-badge`);

    const originRect = milestoneEl?.getBoundingClientRect() || {
      left: Math.max(120, window.innerWidth / 3),
      top: Math.max(150, window.innerHeight / 2),
      width: 24,
      height: 24,
    };

    const startX = originRect.left + originRect.width / 2;
    const startY = originRect.top + originRect.height / 2;

    setPosition({ x: startX, y: startY });

    const duration = 900; // 900ms per DESIGN.md §2
    const startTime = performance.now();
    let frameId: number;

    const animateArc = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Quadratic easeInOut for horizontal, arched apex for vertical
      const easeX = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      const currentX = startX + (targetX - startX) * easeX;

      // Arc apex: curves upward towards header
      const arcHeight = Math.min(startY - targetY + 60, 160);
      const parabola = 4 * progress * (1 - progress);
      const currentY = startY + (targetY - startY) * progress - arcHeight * parabola;

      setPosition({ x: currentX, y: currentY });

      // Slight scale pop as coin approaches balance chip
      if (progress > 0.8) {
        setScale(1 + (1 - progress) * 0.4);
      }
      if (progress > 0.92) {
        setOpacity(Math.max(0, (1 - progress) / 0.08));
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(animateArc);
      } else {
        onComplete();
      }
    };

    frameId = requestAnimationFrame(animateArc);
    return () => cancelAnimationFrame(frameId);
  }, [onComplete]);

  if (!position) return null;

  return (
    <div
      ref={flyerRef}
      className="settle-coin-flyer"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
      }}
    >
      <span>🪙</span>
      <span>+{formatCents(settleData.amountCents)}</span>
    </div>
  );
};

