/**
 * 콜의 브레이크이븐 필요 승률(= 최소 에퀴티)
 * needEquity = call / (pot + call)
 */
export function breakEvenEquity(callCostBB: number, potBB: number): number {
  if (callCostBB <= 0) return 0;
  const denom = potBB + callCostBB;
  if (denom <= 0) return 1;
  return callCostBB / denom;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}