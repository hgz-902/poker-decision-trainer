import {
  ActionType,
  AttemptResult,
  DecisionNode,
  GameState,
  Node,
  Player,
  Position,
  Scenario,
  Street
} from "../types";
import { orderForStreet, nextActivePos } from "./rules";
import { parseScriptAction, decisionActionToLog } from "./parser";

export type Runtime = {
  scenario: Scenario;
  nodeById: Map<string, Node>;
  currentNodeId: string;
  players: Player[];
  state: GameState;
};

export function initRuntime(s: Scenario): Runtime {
  const nodeById = new Map<string, Node>();
  for (const n of s.nodes) nodeById.set(n.nodeId, n);

  const players = s.table.players.map((p) => ({
    ...p,
    active: true,
    investedThisStreet: 0,
    lastAction: ""
  }));

  const state: GameState = {
    ...s.initialState,
    heroHoleCards: s.initialState.heroHoleCards as any,
    actionLog: [...s.initialState.actionLog]
  };

  // ✅ 초기 actionLog를 실제 상태(스택/폴드/배지)로 반영
  applyInitialActionLog(players, state);

  return { scenario: s, nodeById, currentNodeId: s.nodes[0].nodeId, players, state };
}

export function getHeroPos(rt: Runtime): Position {
  const hero = rt.players.find((p) => p.isUser);
  if (!hero) throw new Error("Hero not found");
  return hero.pos;
}

function activePosSet(players: Player[]): Set<Position> {
  return new Set(players.filter((p) => p.active !== false).map((p) => p.pos));
}

function playerByPos(players: Player[], pos: Position): Player {
  const p = players.find((x) => x.pos === pos);
  if (!p) throw new Error(`Player not found: ${pos}`);
  return p;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// pot은 이미 scenario.initialState.pot에 들어있으므로,
// 초기 로그 파싱에서는 pot을 다시 누적하지 않고 stack/invested만 반영한다.
function payWithoutPot(player: Player, delta: number) {
  const pay = Math.max(0, Math.min(player.stack, delta));
  player.stack = round1(player.stack - pay);
  player.investedThisStreet = round1((player.investedThisStreet ?? 0) + pay);
}

function resetStreetState(players: Player[], state: GameState, newStreet: Street) {
  state.street = newStreet;
  state.currentBet = 0;
  for (const p of players) {
    p.investedThisStreet = 0;
    p.lastAction = "";
  }
}

function formatActionLabel(action: string, sizeBB?: number) {
  const a = action.toUpperCase();
  if (a === "FOLD") return "FOLD";
  if (a === "CHECK") return "CHECK";
  if (a === "CALL") return "CALL";
  if (a === "ALL_IN") return "ALL-IN";
  if (a === "BET") return sizeBB != null ? `BET ${sizeBB}BB` : "BET";
  if (a === "RAISE") return sizeBB != null ? `RAISE ${sizeBB}BB` : "RAISE";
  return a;
}

function applyInitialActionLog(players: Player[], state: GameState) {
  // 초기에는 "프리플랍 상태"로 시작했다고 보고,
  // 로그 중 "Flop:"를 만나면 FLOP로 리셋, Turn/River도 동일
  let currentStreet: Street = "PREFLOP";
  resetStreetState(players, state, currentStreet);

  for (const raw of state.actionLog) {
    const line = raw.trim();
    if (!line) continue;

    // Street markers:
    // "Flop: Ks 7d 2c"
    // "Turn: 3h"
    // "River: 9s"
    const mFlop = line.match(/^Flop:\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)$/i);
    if (mFlop) {
      currentStreet = "FLOP";
      state.board = [mFlop[1], mFlop[2], mFlop[3]];
      resetStreetState(players, state, currentStreet);
      continue;
    }

    const mTurn = line.match(/^Turn:\s+([^\s]+)$/i);
    if (mTurn) {
      currentStreet = "TURN";
      state.board = [...(state.board ?? []), mTurn[1]];
      resetStreetState(players, state, currentStreet);
      continue;
    }

    const mRiver = line.match(/^River:\s+([^\s]+)$/i);
    if (mRiver) {
      currentStreet = "RIVER";
      state.board = [...(state.board ?? []), mRiver[1]];
      resetStreetState(players, state, currentStreet);
      continue;
    }

    // Posts:
    // "SB posts 0.5BB"
    const mPost = line.match(/^([A-Z0-9]+)\s+posts\s+([\d.]+)BB$/i);
    if (mPost) {
      const pos = mPost[1].toUpperCase() as Position;
      const amt = Number(mPost[2]);
      const p = players.find((x) => x.pos === pos);
      if (p && Number.isFinite(amt)) {
        payWithoutPot(p, amt);
        p.lastAction = `POST ${amt}BB`;
      }
      continue;
    }

    // S003 같은 형태의 스크립트/로그 라인 처리:
    // "BTN RAISE_TO 2.5"
    // "BB CALL 2.5"
    // "BB CHECK"
    try {
      const a = parseScriptAction(line);

      if (a.kind === "DEAL_FLOP") {
        currentStreet = "FLOP";
        state.board = [...a.cards];
        resetStreetState(players, state, currentStreet);
        continue;
      }
      if (a.kind === "DEAL_TURN") {
        currentStreet = "TURN";
        state.board = [...(state.board ?? []), a.card];
        resetStreetState(players, state, currentStreet);
        continue;
      }
      if (a.kind === "DEAL_RIVER") {
        currentStreet = "RIVER";
        state.board = [...(state.board ?? []), a.card];
        resetStreetState(players, state, currentStreet);
        continue;
      }

      // player actions
      const actor = playerByPos(players, a.actor);
      if (actor.active === false) continue;

      if (a.kind === "FOLD") {
        actor.active = false;
        actor.lastAction = "FOLD";
        continue;
      }

      if (a.kind === "CHECK") {
        actor.lastAction = "CHECK";
        continue;
      }

      if (a.kind === "CALL") {
        // CALL 2.5 같은 형태면 currentBet을 그 값으로 맞춰준다
        if (typeof a.amountBB === "number" && Number.isFinite(a.amountBB)) {
          state.currentBet = Math.max(state.currentBet, a.amountBB);
        }
        const invested = actor.investedThisStreet ?? 0;
        const need = Math.max(0, state.currentBet - invested);
        payWithoutPot(actor, need);
        actor.lastAction = "CALL";
        continue;
      }

      if (a.kind === "ALL_IN") {
        const invested = actor.investedThisStreet ?? 0;
        const needToCall = Math.max(0, state.currentBet - invested);
        payWithoutPot(actor, needToCall + actor.stack);
        actor.lastAction = "ALL-IN";
        continue;
      }

      if (a.kind === "BET_TO" || a.kind === "RAISE_TO") {
        const target = a.amountBB ?? 0;
        const invested = actor.investedThisStreet ?? 0;
        const delta = Math.max(0, target - invested);

        payWithoutPot(actor, delta);
        state.currentBet = Math.max(state.currentBet, target);

        actor.lastAction = a.kind === "BET_TO" ? `BET ${target}BB` : `RAISE ${target}BB`;
        continue;
      }
    } catch {
      // parseScriptAction이 못 읽는 라인은 무시(텍스트 로그로만 유지)
    }
  }

  // 최종적으로 scenario.initialState.street(예: FLOP)로 맞춘다.
  // (S003는 initialState.street가 FLOP이므로 FLOP 이후 상태가 보이게 됨)
  // 만약 로그가 street 마커 없이 끝났어도 UI는 initialState.street 기준으로 시작.
  // 여기서는 state.street를 initialState.street로 덮어쓰진 않음(이미 actionLog로 반영됨).
}

export function applyScriptNode(rt: Runtime, nodeId: string): void {
  const node = rt.nodeById.get(nodeId);
  if (!node || node.type !== "SCRIPT") throw new Error("Not a script node");

  // 노드의 street로 진입
  if (rt.state.street !== node.street) {
    resetStreetState(rt.players, rt.state, node.street);
  }

  const order = orderForStreet(rt.state.street);

  for (const line of node.scriptActions) {
    const a = parseScriptAction(line);

    // ✅ DEAL 처리
    if (a.kind === "DEAL_FLOP") {
      rt.state.board = [...a.cards];
      resetStreetState(rt.players, rt.state, "FLOP");
      rt.state.actionLog.push(`Flop: ${a.cards.join(" ")}`);
      continue;
    }
    if (a.kind === "DEAL_TURN") {
      rt.state.board = [...(rt.state.board ?? []), a.card];
      resetStreetState(rt.players, rt.state, "TURN");
      rt.state.actionLog.push(`Turn: ${a.card}`);
      continue;
    }
    if (a.kind === "DEAL_RIVER") {
      rt.state.board = [...(rt.state.board ?? []), a.card];
      resetStreetState(rt.players, rt.state, "RIVER");
      rt.state.actionLog.push(`River: ${a.card}`);
      continue;
    }

    const actor = playerByPos(rt.players, a.actor);
    if (actor.active === false) continue;

    const set = activePosSet(rt.players);

    if (a.kind === "FOLD") {
      actor.active = false;
      actor.lastAction = "FOLD";
      rt.state.actionLog.push(`${a.actor} folds`);
      rt.state.toActPos = nextActivePos(order, activePosSet(rt.players), a.actor);
      continue;
    }

    if (a.kind === "CHECK") {
      actor.lastAction = "CHECK";
      rt.state.actionLog.push(`${a.actor} checks`);
      rt.state.toActPos = nextActivePos(order, set, a.actor);
      continue;
    }

    if (a.kind === "CALL") {
      if (typeof a.amountBB === "number" && Number.isFinite(a.amountBB)) {
        rt.state.currentBet = Math.max(rt.state.currentBet, a.amountBB);
      }
      const invested = actor.investedThisStreet ?? 0;
      const need = Math.max(0, rt.state.currentBet - invested);

      // 실제 진행이므로 pot도 누적
      const pay = Math.max(0, Math.min(actor.stack, need));
      actor.stack = round1(actor.stack - pay);
      actor.investedThisStreet = round1((actor.investedThisStreet ?? 0) + pay);
      rt.state.pot = round1(rt.state.pot + pay);

      actor.lastAction = "CALL";
      rt.state.actionLog.push(`${a.actor} calls`);
      rt.state.toActPos = nextActivePos(order, set, a.actor);
      continue;
    }

    if (a.kind === "ALL_IN") {
      const invested = actor.investedThisStreet ?? 0;
      const needToCall = Math.max(0, rt.state.currentBet - invested);
      const total = needToCall + actor.stack;

      const pay = Math.max(0, Math.min(actor.stack, total));
      actor.stack = round1(actor.stack - pay);
      actor.investedThisStreet = round1((actor.investedThisStreet ?? 0) + pay);
      rt.state.pot = round1(rt.state.pot + pay);

      actor.lastAction = "ALL-IN";
      rt.state.actionLog.push(`${a.actor} goes all-in`);
      rt.state.toActPos = nextActivePos(order, set, a.actor);
      continue;
    }

    if (a.kind === "BET_TO" || a.kind === "RAISE_TO") {
      const target = a.amountBB ?? 0;
      const invested = actor.investedThisStreet ?? 0;
      const delta = Math.max(0, target - invested);

      const pay = Math.max(0, Math.min(actor.stack, delta));
      actor.stack = round1(actor.stack - pay);
      actor.investedThisStreet = round1((actor.investedThisStreet ?? 0) + pay);
      rt.state.pot = round1(rt.state.pot + pay);

      rt.state.currentBet = Math.max(rt.state.currentBet, target);

      if (a.kind === "BET_TO") {
        actor.lastAction = `BET ${target}BB`;
        rt.state.actionLog.push(`${a.actor} bets to ${target}BB`);
      } else {
        actor.lastAction = `RAISE ${target}BB`;
        rt.state.actionLog.push(`${a.actor} raises to ${target}BB`);
      }

      rt.state.toActPos = nextActivePos(order, set, a.actor);
      continue;
    }
  }
}

export function gradeDecision(node: DecisionNode, chosenAction: ActionType, chosenSizeBB?: number | null) {
  const correctAction = node.correct.action;
  if (node.correct.grading === "EXACT") {
    return chosenAction === correctAction;
  }
  if (node.correct.grading === "EXACT_OR_CLOSE") {
    if (chosenAction !== correctAction) return false;
    const target = node.correct.sizeBB;
    if (target == null) return true;
    const c = chosenSizeBB ?? null;
    if (c == null) return false;
    if (Math.abs(c - target) < 1e-9) return true;
    const close = node.correct.closeSizesBB ?? [];
    return close.some((x) => Math.abs(x - c) < 1e-9);
  }
  return false;
}

export function applyUserDecisionToState(rt: Runtime, node: DecisionNode, chosenAction: ActionType, chosenSizeBB?: number | null) {
  // 노드 스트리트 진입 시 리셋(턴/리버로 넘어간 Decision이면 투자액 등 초기화)
  if (rt.state.street !== node.street) {
    resetStreetState(rt.players, rt.state, node.street);
  }

  const heroPos = getHeroPos(rt);
  const hero = playerByPos(rt.players, heroPos);

  if (!node.legalActions.includes(chosenAction)) {
    throw new Error(`Illegal action: ${chosenAction}`);
  }

  const order = orderForStreet(rt.state.street);
  const active = activePosSet(rt.players);

  if (chosenAction === "FOLD") {
    hero.active = false;
    hero.lastAction = formatActionLabel("FOLD");
    rt.state.actionLog.push(decisionActionToLog(heroPos, chosenAction));
  } else if (chosenAction === "CHECK") {
    hero.lastAction = formatActionLabel("CHECK");
    rt.state.actionLog.push(decisionActionToLog(heroPos, chosenAction));
  } else if (chosenAction === "CALL") {
    const invested = hero.investedThisStreet ?? 0;
    const need = Math.max(0, rt.state.currentBet - invested);

    const pay = Math.max(0, Math.min(hero.stack, need));
    hero.stack = round1(hero.stack - pay);
    hero.investedThisStreet = round1((hero.investedThisStreet ?? 0) + pay);
    rt.state.pot = round1(rt.state.pot + pay);

    hero.lastAction = formatActionLabel("CALL");
    rt.state.actionLog.push(decisionActionToLog(heroPos, chosenAction));
  } else if (chosenAction === "ALL_IN") {
    const invested = hero.investedThisStreet ?? 0;
    const needToCall = Math.max(0, rt.state.currentBet - invested);
    const total = needToCall + hero.stack;

    const pay = Math.max(0, Math.min(hero.stack, total));
    hero.stack = round1(hero.stack - pay);
    hero.investedThisStreet = round1((hero.investedThisStreet ?? 0) + pay);
    rt.state.pot = round1(rt.state.pot + pay);

    hero.lastAction = formatActionLabel("ALL_IN");
    rt.state.actionLog.push(decisionActionToLog(heroPos, chosenAction));
  } else if (chosenAction === "RAISE" || chosenAction === "BET") {
    const target = chosenSizeBB ?? 0;
    const invested = hero.investedThisStreet ?? 0;
    const delta = Math.max(0, target - invested);

    const pay = Math.max(0, Math.min(hero.stack, delta));
    hero.stack = round1(hero.stack - pay);
    hero.investedThisStreet = round1((hero.investedThisStreet ?? 0) + pay);
    rt.state.pot = round1(rt.state.pot + pay);

    rt.state.currentBet = Math.max(rt.state.currentBet, target);

    hero.lastAction = formatActionLabel(chosenAction, target);
    rt.state.actionLog.push(decisionActionToLog(heroPos, chosenAction, target));
  }

  rt.state.toActPos = nextActivePos(order, active, heroPos);
}

export function makeAttemptResult(
  scenarioId: string,
  nodeId: string,
  chosenAction: ActionType,
  chosenSizeBB: number | null | undefined,
  isCorrect: boolean
): AttemptResult {
  return {
    scenarioId,
    nodeId,
    chosenAction,
    chosenSizeBB: chosenSizeBB ?? null,
    isCorrect,
    timestamp: Date.now()
  };
}
