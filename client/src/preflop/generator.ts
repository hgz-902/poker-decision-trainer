import { PreflopSpot, PlayerState, Position10, TournamentPhase } from "./types";
import { clamp, round1 } from "./math";
import { applyPreflopAction, computeCallCost, computePot, capStacks100 } from "./engine";

const POS_10: Position10[] = ["UTG","UTG1","UTG2","UTG3","LJ","HJ","CO","BTN","SB","BB"];

const PHASES: TournamentPhase[] = [
  "EARLY","MID","REG_CLOSE_SOON","REG_CLOSED","BUBBLE","PAY_JUMP"
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function chance(p: number) {
  return Math.random() < p;
}
function randomSuit() {
  return pick(["s","h","d","c"] as const);
}

/** 간단 랜덤 핸드(후에 169 유니크로 개선 가능) */
function randomHand(): string {
  const ranks = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"] as const;
  const r1 = pick(ranks);
  const r2 = pick(ranks);

  if (r1 === r2) {
    let s1 = randomSuit();
    let s2 = randomSuit();
    while (s2 === s1) s2 = randomSuit();
    return `${r1}${s1}${r2}${s2}`;
  }

  if (chance(0.35)) {
    const s = randomSuit();
    return `${r1}${s}${r2}${s}`; // suited
  } else {
    const s1 = randomSuit();
    let s2 = randomSuit();
    while (s2 === s1) s2 = randomSuit();
    return `${r1}${s1}${r2}${s2}`;
  }
}

/** 스택 구간 랜덤(요구사항 버킷) */
function randomStackBucket(): number {
  const buckets = [
    [1, 4],
    [5, 10],
    [10, 15],
    [15, 20],
    [20, 29],
    [30, 39],
    [40, 49],
    [50, 59],
    [60, 69],
    [70, 79],
    [80, 89],
    [90, 99],
    [100, 100],
  ] as const;

  const [lo, hi] = pick(buckets);
  return randInt(lo, hi);
}

function positionsBefore(pos: Position10): Position10[] {
  const idx = POS_10.indexOf(pos);
  return POS_10.slice(0, idx);
}

function makePlayers(heroPos: Position10): PlayerState[] {
  return POS_10.map((pos) => {
    // ✅ hero는 최소 5BB 이상으로
    const stack = pos === heroPos ? randInt(5, 100) : randomStackBucket();

    return {
      pos,
      stackBB: stack,
      inHand: true,
      investedBB: 0,
      anteBB: 0,
      lastAction: "",
      isHero: pos === heroPos,
    };
  });
}

/** 오픈 + (hero 이전) 콜 몇 명 라인 */
function generateOpenCallLine(heroPos: Position10) {
  const before = positionsBefore(heroPos);
  const openerPos = before.length ? pick(before) : heroPos;

  const openSizeBB = pick([2.0, 2.2, 2.5, 3.0, 3.5] as const);

  const openerIdx = POS_10.indexOf(openerPos);
  const heroIdx = POS_10.indexOf(heroPos);
  const between = POS_10.slice(openerIdx + 1, heroIdx);

  const maxCallers = Math.min(3, between.length);
  const numCallers = between.length ? randInt(0, maxCallers) : 0;

  const shuffled = between.slice().sort(() => Math.random() - 0.5);
  const callers = shuffled.slice(0, numCallers);

  const summary =
    `${openerPos} OPEN ${openSizeBB}BB` +
    (callers.length ? `, ${callers.join(", ")} CALL ${openSizeBB}BB` : "");

  return { openerPos, openSizeBB, callers, summary };
}

export function generatePreflopSpot(): PreflopSpot {
  const HERO_POS: readonly Position10[] = ["UTG1","UTG2","UTG3","LJ","HJ","CO","BTN","SB","BB"] as const;
const heroPos = pick(HERO_POS);
  const heroHand = randomHand();
  const phase = pick(PHASES);

  // ✅ 고정 규칙: SB=0.5, BB=1, BBA=1
  const sb = 0.5;
  const bb = 1.0;
  const ante = 1.0; // 여기서는 "BBA"로 사용(=BB만 냄)

  const players = makePlayers(heroPos);

  // --- 먼저 블라인드 + BBA 적용(엔진으로 invested/stack 정확 반영) ---
  applyPreflopAction(players, "SB", { kind: "POST_SB", amountBB: sb });
  applyPreflopAction(players, "BB", { kind: "POST_BB", amountBB: bb });

  // ✅ BBA: BB만 ANTE 1BB 추가
  applyPreflopAction(players, "BB", { kind: "ANTE", amountBB: ante });

  // --- 오픈/콜 라인 생성 후 반영 ---
  const line = generateOpenCallLine(heroPos);

  // opener raise_to
  applyPreflopAction(players, line.openerPos, { kind: "RAISE_TO", toBB: line.openSizeBB });

  // callers call to openSize
  for (const cpos of line.callers) {
    applyPreflopAction(players, cpos, { kind: "CALL", toBB: line.openSizeBB });
  }

  // ✅ 블라인드/앤티로 스택이 0이 된 플레이어는 OUT 처리
for (const p of players) {
  if (p.stackBB <= 0) {
    p.stackBB = 0;
    p.inHand = false;
    if (!p.lastAction) p.lastAction = "OUT";
  }
}

  // hero는 아직 액션 전이므로 lastAction 비워두기(보기 좋게)
  const hero = players.find((p) => p.pos === heroPos)!;
  hero.lastAction = "";

  // ✅ pot/currentBet/callCost는 invested 기반으로 계산
  const { potBB } = computePot(players);
  const { callCostBB, currentBet } = computeCallCost(players, heroPos);

  // ✅ 100BB+는 100으로 캡
  capStacks100(players);

  const heroAfter = players.find((p) => p.pos === heroPos)!;
if (heroAfter.stackBB <= 0 || heroAfter.inHand === false) {
  // hero가 0BB 또는 OUT이면 스팟을 다시 뽑는다
  return generatePreflopSpot();
}

  return {
    id: `PF-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    table: "10MAX",
    phase,
    sb,
    bb,
    ante, // 표시용(=BBA 1)
    heroPos,
    heroHand,
    players,
    toAct: heroPos,
    potBB: round1(potBB),
    callCostBB: round1(callCostBB),
    lineSummary: line.summary + ` (BBA ${ante}BB)`,
    openerPos: line.openerPos,
openSizeBB: line.openSizeBB,
  };
}