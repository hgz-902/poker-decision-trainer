import { clamp, round2 } from "./math";

/**
 * handCode: "AsTd" / "7s8s" 같은 4글자
 * 반환: "AJo", "78s", "66" 같은 169 키
 */
export function toHandKey(handCode: string): string {
  const r1 = handCode[0];
  const s1 = handCode[1];
  const r2 = handCode[2];
  const s2 = handCode[3];

  const order = "AKQJT98765432";
  const a = r1.toUpperCase();
  const b = r2.toUpperCase();

  // 정렬(랭크 큰 게 앞)
  const hi = order.indexOf(a) <= order.indexOf(b) ? a : b;
  const lo = hi === a ? b : a;

  if (hi === lo) return `${hi}${lo}`; // pair

  const suited = s1 === s2;
  return `${hi}${lo}${suited ? "s" : "o"}`;
}

function rankVal(r: string): number {
  switch (r) {
    case "A": return 10;
    case "K": return 8;
    case "Q": return 7;
    case "J": return 6;
    case "T": return 5;
    case "9": return 4.5;
    case "8": return 4;
    case "7": return 3.5;
    case "6": return 3;
    case "5": return 2.5;
    case "4": return 2;
    case "3": return 1.5;
    case "2": return 1;
    default: return 0;
  }
}

function gapPenalty(gap: number): number {
  if (gap <= 0) return 0;
  if (gap === 1) return 1;
  if (gap === 2) return 2;
  if (gap === 3) return 4;
  return 5;
}

/**
 * Chen formula (0~20ish)
 * - 빠른 근사 점수용 (룩업 테이블 생성에 사용)
 */
function chenScoreFromKey(key: string): number {
  // key: "AJo" "78s" "66"
  const isPair = key.length === 2;
  const r1 = key[0];
  const r2 = key[1];
  const suited = key.length === 3 ? key[2] === "s" : false;

  if (isPair) {
    let p = rankVal(r1);
    // pair base
    let score = Math.max(5, p * 2);
    if (r1 === "A") score = 20;
    return score;
  }

  let score = Math.max(rankVal(r1), rankVal(r2));

  if (suited) score += 2;

  const order = "AKQJT98765432";
  const i1 = order.indexOf(r1);
  const i2 = order.indexOf(r2);
  const gap = Math.abs(i1 - i2) - 1;

  score -= gapPenalty(gap);

  // connector/low bonus
  const hiRank = Math.min(i1, i2);
  if (gap === 0) score += 1; // connectors
  if (gap === 1) score += 0.5;

  // small cards bonus (to avoid over-penalizing suited connectors)
  if (r1 === "A" || r2 === "A") {
    // no extra
  } else {
    if (hiRank >= order.indexOf("9")) score += 0.5; // 9-high 이하이면 약간 보정
  }

  return clamp(score, 0, 20);
}

/**
 * HU 에퀴티 근사(상대=랜덤 가정)
 * - score 0~20 -> equity 0.28~0.85 선형 매핑
 */
function equityHUFromScore(score: number): number {
  const e = 0.28 + (score / 20) * 0.57; // 0.28~0.85
  return clamp(e, 0.25, 0.87);
}

/**
 * 멀티웨이 보정(랜덤 상대 가정)
 */
function adjustForOpponents(eHU: number, oppCount: number): number {
  if (oppCount <= 1) return eHU;                 // HU
  if (oppCount === 2) return eHU * 0.73;         // 3way
  if (oppCount === 3) return eHU * 0.63;         // 4way
  if (oppCount === 4) return eHU * 0.56;         // 5way
  return eHU * 0.50;                              // 6way+
}

/**
 * public API: handCode + opponents -> equity(0~1)
 */
export function estimateEquityVsRandom(handCode: string, oppCount: number): number {
  const key = toHandKey(handCode);
  const score = chenScoreFromKey(key);
  const eHU = equityHUFromScore(score);
  const e = adjustForOpponents(eHU, oppCount);
  return clamp(e, 0.05, 0.87);
}

/**
 * 디버그/설명용: key, score, HU equity
 */
export function equityDebug(handCode: string) {
  const key = toHandKey(handCode);
  const score = chenScoreFromKey(key);
  const eHU = equityHUFromScore(score);
  return { key, score: round2(score), eHU: round2(eHU) };
}