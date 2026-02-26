import { parseHand, isPair, isBroadway, isAxSuited, isKxSuited, isSuitedConnector } from "./handRules";
import { Position10 } from "./types";

function rankOrder(r: string) {
  return "AKQJT98765432".indexOf(r);
}

export function isPremiumKey(key: string) {
  return key === "AA" || key === "KK" || key === "QQ" || key === "AKs" || key === "AKo" || key === "JJ";
}

export function shouldThreeBet(opts: {
  heroHand: string;
  heroPos: Position10;
  openerPos: Position10;
  heroStackBB: number;
  openerStackBB: number;
  phase: "EARLY" | "MID" | "REG_CLOSE_SOON" | "REG_CLOSED" | "BUBBLE" | "PAY_JUMP";
  handKey: string; // toHandKey 결과
}) {
  const { heroHand, heroPos, openerPos, heroStackBB, openerStackBB, phase, handKey } = opts;
  const { hi, lo, suited } = parseHand(heroHand);

  // 1) 프리미엄: 거의 항상 3bet
  if (isPremiumKey(handKey)) return true;

  // 2) 아주 짧은 오프너(커밋)에 가까우면: 3bet 범위를 오히려 좁힘(강한 것만)
  const openerRatio = openerStackBB / Math.max(0.1, 2.2); // openSize를 못 받는 상황 대비(대충)
  const openerVeryShort = openerStackBB <= 12 || openerRatio <= 6;
  if (openerVeryShort) {
    // 커밋이면 value 위주: TT+, AQ+ 정도(간단)
    if (isPair(heroHand) && rankOrder(hi) <= rankOrder("T")) return true; // TT+
    if (suited && hi === "A" && rankOrder(lo) <= rankOrder("Q")) return true; // AQs+
    if (!suited && hi === "A" && rankOrder(lo) <= rankOrder("Q")) return true; // AQo+
    return false;
  }

  // 3) 토너 후반(버블/점프)은 3bet 블러프를 줄임
  const tightPhase = phase === "BUBBLE" || phase === "PAY_JUMP";
  if (tightPhase) {
    // value 위주: TT+, AQ+, AJs+, KQs
    if (isPair(heroHand) && rankOrder(hi) <= rankOrder("T")) return true; // TT+
    if (suited && hi === "A" && rankOrder(lo) <= rankOrder("J")) return true; // AJs+
    if (!suited && hi === "A" && rankOrder(lo) <= rankOrder("Q")) return true; // AQo+
    if (suited && hi === "K" && lo === "Q") return true; // KQs
    return false;
  }

  // 4) 기본(초/중반): value + 일부 블러프(수딧/포켓/커넥터 중심, 옵숫 확장 금지)
  // value: 99+, AJs+, AQo+, KQs
  if (isPair(heroHand) && rankOrder(hi) <= rankOrder("9")) return true; // 99+
  if (suited && hi === "A" && rankOrder(lo) <= rankOrder("J")) return true; // AJs+
  if (!suited && hi === "A" && rankOrder(lo) <= rankOrder("Q")) return true; // AQo+
  if (suited && hi === "K" && lo === "Q") return true; // KQs

  // 블러프 후보: A5s~A2s, KTs/KJs 수딧, suited connector(T9s/98s/87s)
  if (isAxSuited(heroHand) && rankOrder(lo) >= rankOrder("5")) return true; // A5s~A2s (lo가 5,4,3,2)
  if (suited && hi === "K" && (lo === "T" || lo === "J")) return true; // KTs, KJs
  if (isSuitedConnector(heroHand) && (hi === "T" || hi === "9" || hi === "8" || hi === "7")) return true;

  return false;
}