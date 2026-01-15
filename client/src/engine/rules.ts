import { Position, Street } from "../types";

export const PREFLOP_ORDER: Position[] = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
export const POSTFLOP_ORDER: Position[] = ["SB", "BB", "UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN"];

export function orderForStreet(street: Street): Position[] {
  return street === "PREFLOP" ? PREFLOP_ORDER : POSTFLOP_ORDER;
}

export function nextActivePos(order: Position[], activeSet: Set<Position>, current: Position): Position {
  const idx = order.indexOf(current);
  if (idx < 0) return current;
  for (let step = 1; step <= order.length; step++) {
    const p = order[(idx + step) % order.length];
    if (activeSet.has(p)) return p;
  }
  return current;
}
