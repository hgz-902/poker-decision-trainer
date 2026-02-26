import { PlayerState, Position10 } from "./types";
import { clamp, round1 } from "./math";

export type PreflopAction =
  | { kind: "POST_SB"; amountBB: number }
  | { kind: "POST_BB"; amountBB: number }
  | { kind: "ANTE"; amountBB: number }
  | { kind: "FOLD" }
  | { kind: "CALL"; toBB: number }     // currentBet까지 맞추기
  | { kind: "RAISE_TO"; toBB: number } // invested를 toBB로 맞추기
  | { kind: "SHOVE" };                 // 남은 스택 전부 넣기(= invested 증가)

export function getPlayer(players: PlayerState[], pos: Position10): PlayerState {
  const p = players.find((x) => x.pos === pos);
  if (!p) throw new Error(`Player not found: ${pos}`);
  return p;
}

function payTo(players: PlayerState[], pos: Position10, targetInvested: number) {
  const p = getPlayer(players, pos);
  const need = Math.max(0, targetInvested - (p.investedBB ?? 0));
  const pay = Math.min(p.stackBB, need);
  p.stackBB = round1(p.stackBB - pay);
  p.investedBB = round1((p.investedBB ?? 0) + pay);
}

export function applyPreflopAction(players: PlayerState[], pos: Position10, action: PreflopAction) {
  const p = getPlayer(players, pos);

  if (action.kind === "FOLD") {
    p.inHand = false;
    p.lastAction = "FOLD";
    return;
  }

  if (action.kind === "ANTE") {
  const pay = Math.min(p.stackBB, action.amountBB);
  p.stackBB = round1(p.stackBB - pay);

  // 팟에는 들어가야 하므로 investedBB에는 포함
  p.investedBB = round1((p.investedBB ?? 0) + pay);

  // ✅ 하지만 "콜/레이즈 맞추기"에는 포함되지 않도록 따로 기록
  p.anteBB = round1((p.anteBB ?? 0) + pay);

  p.lastAction = `ANTE ${action.amountBB}BB`;
  return;
}

  if (action.kind === "POST_SB") {
    const pay = Math.min(p.stackBB, action.amountBB);
    p.stackBB = round1(p.stackBB - pay);
    p.investedBB = round1((p.investedBB ?? 0) + pay);
    p.lastAction = `POST ${action.amountBB}BB`;
    return;
  }

  if (action.kind === "POST_BB") {
    const pay = Math.min(p.stackBB, action.amountBB);
    p.stackBB = round1(p.stackBB - pay);
    p.investedBB = round1((p.investedBB ?? 0) + pay);
    p.lastAction = `POST ${action.amountBB}BB`;
    return;
  }

  if (action.kind === "CALL") {
    payTo(players, pos, action.toBB);
    p.lastAction = `CALL ${action.toBB}BB`;
    return;
  }

  if (action.kind === "RAISE_TO") {
    payTo(players, pos, action.toBB);
    p.lastAction = `RAISE ${action.toBB}BB`;
    return;
  }

  if (action.kind === "SHOVE") {
    const all = p.stackBB;
    p.stackBB = 0;
    p.investedBB = round1((p.investedBB ?? 0) + all);
    p.lastAction = "ALL-IN";
    return;
  }
}

export function computePot(players: PlayerState[]) {
  const potBB = round1(players.reduce((sum, p) => sum + (p.investedBB ?? 0), 0));
  const currentBet = round1(
    players
      .filter((p) => p.inHand)
      .reduce((m, p) => Math.max(m, p.investedBB ?? 0), 0)
  );
  return { potBB, currentBet };
}

export function computeCallCost(players: PlayerState[], heroPos: Position10) {
  const hero = getPlayer(players, heroPos);
  const { currentBet } = computePot(players);

  const invested = hero.investedBB ?? 0;
  const ante = hero.anteBB ?? 0;

  // ✅ 오프라인 룰: ante는 콜/레이즈를 맞추는 투자에 포함되지 않는다
  const investedForBetting = Math.max(0, invested - ante);

  const callCost = round1(Math.max(0, currentBet - investedForBetting));
  return { callCostBB: callCost, currentBet };
}

export function capStacks100(players: PlayerState[]) {
  for (const p of players) {
    p.stackBB = clamp(p.stackBB, 0, 100);
  }
}