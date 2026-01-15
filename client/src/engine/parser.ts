import { Position } from "../types";

type PlayerAction =
  | { kind: "FOLD"; actor: Position }
  | { kind: "CHECK"; actor: Position }
  | { kind: "CALL"; actor: Position; amountBB?: number }
  | { kind: "ALL_IN"; actor: Position }
  | { kind: "BET_TO"; actor: Position; amountBB: number }
  | { kind: "RAISE_TO"; actor: Position; amountBB: number };

type DealAction =
  | { kind: "DEAL_FLOP"; cards: string[] }
  | { kind: "DEAL_TURN"; card: string }
  | { kind: "DEAL_RIVER"; card: string };

export type ScriptAction = PlayerAction | DealAction;

function toNum(s: string | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseScriptAction(line: string): ScriptAction {
  const t = line.trim();
  if (!t) throw new Error("Empty script action");

  const parts = t.split(/\s+/);

  // DEAL_* 지원
  const head = parts[0].toUpperCase();
  if (head === "DEAL_FLOP") {
    const cards = parts.slice(1);
    if (cards.length !== 3) throw new Error(`DEAL_FLOP needs 3 cards: ${line}`);
    return { kind: "DEAL_FLOP", cards };
  }
  if (head === "DEAL_TURN") {
    const card = parts[1];
    if (!card) throw new Error(`DEAL_TURN needs 1 card: ${line}`);
    return { kind: "DEAL_TURN", card };
  }
  if (head === "DEAL_RIVER") {
    const card = parts[1];
    if (!card) throw new Error(`DEAL_RIVER needs 1 card: ${line}`);
    return { kind: "DEAL_RIVER", card };
  }

  // 플레이어 액션: "<POS> <ACTION> [AMOUNT]"
  const actor = parts[0].toUpperCase() as Position;
  const action = (parts[1] ?? "").toUpperCase();
  const amount = toNum(parts[2]);

  if (!action) throw new Error(`Invalid action: ${line}`);

  if (action === "FOLD") return { kind: "FOLD", actor };
  if (action === "CHECK") return { kind: "CHECK", actor };
  if (action === "ALL_IN") return { kind: "ALL_IN", actor };

  // ✅ CALL [amount] 지원
  if (action === "CALL") {
    return amount != null ? { kind: "CALL", actor, amountBB: amount } : { kind: "CALL", actor };
  }

  // ✅ BET <amount> 를 BET_TO로 취급
  if (action === "BET") {
    if (amount == null) throw new Error(`BET needs amount: ${line}`);
    return { kind: "BET_TO", actor, amountBB: amount };
  }

  // ✅ RAISE <amount> 를 RAISE_TO로 취급
  if (action === "RAISE") {
    if (amount == null) throw new Error(`RAISE needs amount: ${line}`);
    return { kind: "RAISE_TO", actor, amountBB: amount };
  }

  // 기존 BET_TO / RAISE_TO도 계속 지원
  if (action === "BET_TO") {
    if (amount == null) throw new Error(`BET_TO needs amount: ${line}`);
    return { kind: "BET_TO", actor, amountBB: amount };
  }

  if (action === "RAISE_TO") {
    if (amount == null) throw new Error(`RAISE_TO needs amount: ${line}`);
    return { kind: "RAISE_TO", actor, amountBB: amount };
  }

  throw new Error(`Unknown script action: ${line}`);
}

export function decisionActionToLog(pos: Position, action: string, sizeBB?: number) {
  const a = action.toUpperCase();
  if (a === "FOLD") return `${pos} folds`;
  if (a === "CHECK") return `${pos} checks`;
  if (a === "CALL") return `${pos} calls`;
  if (a === "ALL_IN") return `${pos} goes all-in`;
  if (a === "BET") return sizeBB != null ? `${pos} bets to ${sizeBB}BB` : `${pos} bets`;
  if (a === "RAISE") return sizeBB != null ? `${pos} raises to ${sizeBB}BB` : `${pos} raises`;
  return `${pos} ${a}`;
}
