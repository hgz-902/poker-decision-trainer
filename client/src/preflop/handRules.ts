import { toHandKey } from "./equityTable";

const ORDER = "AKQJT98765432";

function rankIndex(r: string) {
  return ORDER.indexOf(r);
}

export function parseHand(handCode: string) {
  const r1 = handCode[0].toUpperCase();
  const s1 = handCode[1];
  const r2 = handCode[2].toUpperCase();
  const s2 = handCode[3];
  const suited = s1 === s2;

  // 정렬(hi, lo)
  const hi = rankIndex(r1) <= rankIndex(r2) ? r1 : r2;
  const lo = hi === r1 ? r2 : r1;

  return { hi, lo, suited };
}

export function isPair(handCode: string) {
  const { hi, lo } = parseHand(handCode);
  return hi === lo;
}

export function isSuited(handCode: string) {
  return parseHand(handCode).suited;
}

export function isBroadwayRank(r: string) {
  return ["A","K","Q","J","T"].includes(r);
}

export function isBroadway(handCode: string) {
  const { hi, lo } = parseHand(handCode);
  return isBroadwayRank(hi) && isBroadwayRank(lo);
}

export function isAxSuited(handCode: string) {
  const { hi, lo, suited } = parseHand(handCode);
  return suited && (hi === "A" || lo === "A");
}

export function isKxSuited(handCode: string) {
  const { hi, lo, suited } = parseHand(handCode);
  if (!suited) return false;
  return hi === "K" || lo === "K";
}

export function isQ6PlusSuited(handCode: string) {
  const { hi, lo, suited } = parseHand(handCode);
  if (!suited) return false;
  // Qx suited where x >= 6
  if (hi !== "Q") return false;
  return rankIndex(lo) <= rankIndex("6");
}

export function isJ6PlusSuited(handCode: string) {
  const { hi, lo, suited } = parseHand(handCode);
  if (!suited) return false;
  if (hi !== "J") return false;
  return rankIndex(lo) <= rankIndex("6");
}

export function isSuitedConnector(handCode: string) {
  const { hi, lo, suited } = parseHand(handCode);
  if (!suited) return false;
  if (hi === lo) return false;
  const gap = Math.abs(rankIndex(hi) - rankIndex(lo));
  return gap === 1; // T9, 98, 87 ...
}

/**
 * “딥해서 레인지를 넓힐 때” 허용되는 핸드인가?
 * - 포켓
 * - suited connector
 * - Ax suited
 * - Kx suited
 * - Q6+ suited
 * - J6+ suited
 * - (옵숫 확장은 금지)
 */
export function allowedExpansionHand(handCode: string) {
  if (isPair(handCode)) return true;
  if (isSuitedConnector(handCode)) return true;
  if (isAxSuited(handCode)) return true;
  if (isKxSuited(handCode)) return true;
  if (isQ6PlusSuited(handCode)) return true;
  if (isJ6PlusSuited(handCode)) return true;
  return false;
}

/**
 * 15BB 미만 푸시폴드(올인) 범위 규칙
 * - 10~15BB: 66+, T9s+, 모든 브로드웨이 suited, Ax suited, 브로드웨이 offsuit
 * - 5~10BB: 모든 포켓, 모든 Ax(offsuit 포함), 브로드웨이(offsuit 포함), suited connectors 87s+
 * - <5BB: 거의 생존 올인: 모든 포켓, 모든 Ax, K9s+, QTs+, JTs, T9s, 98s, 87s
 */
export function shoveRangeAllowed(handCode: string, stackBB: number) {
  const { hi, lo, suited } = parseHand(handCode);
  const key = toHandKey(handCode); // "AJo" "78s" "66"

  const pair = hi === lo;

  // helpers
  const loIdx = rankIndex(lo);
  const hiIdx = rankIndex(hi);

  const isAx = hi === "A" || lo === "A";
  const isKx = hi === "K" || lo === "K";
  const isQx = hi === "Q" || lo === "Q";
  const isJx = hi === "J" || lo === "J";

  const broadway = isBroadway(handCode);
  const broadwaySuited = broadway && suited;
  const broadwayOff = broadway && !suited;

  // pair rank check: 66+ means lo rank <= 6
  const pair66plus = pair && rankIndex(hi) <= rankIndex("6");

  // suited connector threshold
  const suitedConn = isSuitedConnector(handCode);
  const t9sPlus = suited && suitedConn && rankIndex(hi) <= rankIndex("T"); // T9s, JTs, QJs...
  const n87sPlus = suited && suitedConn && rankIndex(hi) <= rankIndex("8"); // 87s, 98s, T9s...

  if (stackBB < 5) {
    if (pair) return true;
    if (isAx) return true;
    if (suited && isKx && rankIndex(lo) <= rankIndex("9")) return true; // K9s+
    if (suited && broadway) return true; // QJs, KTs...
    if (key === "JTs" || key === "T9s" || key === "98s" || key === "87s") return true;
    return false;
  }

  if (stackBB < 10) {
    if (pair) return true;
    if (isAx) return true; // A2o+ 포함
    if (broadway) return true; // 브로드웨이 오프 포함
    if (n87sPlus) return true; // 87s+
    return false;
  }

  if (stackBB < 15) {
    if (pair66plus) return true;
    if (t9sPlus) return true; // T9s+
    if (broadwaySuited) return true;
    if (isAx && suited) return true; // Ax suited
    if (broadwayOff) return true;
    return false;
  }

  return false;
}