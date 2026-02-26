export type Street = "PREFLOP";

export type TableType = "10MAX";

export type Position10 =
  | "UTG"
  | "UTG1"
  | "UTG2"
  | "UTG3"
  | "LJ"
  | "HJ"
  | "CO"
  | "BTN"
  | "SB"
  | "BB";

export type TournamentPhase =
  | "EARLY"
  | "MID"
  | "REG_CLOSE_SOON"
  | "REG_CLOSED"
  | "BUBBLE"
  | "PAY_JUMP";

export type ActionType =
  | "FOLD"
  | "CHECK"
  | "CALL"
  | "OPEN"
  | "RAISE"
  | "3BET"
  | "4BET"
  | "5BET"
  | "ALL_IN";

export type PlayerState = {
  pos: Position10;
  stackBB: number; // 0~100 (100+=100으로 캡)
  inHand: boolean; // 이 핸드에 참여중?
  investedBB: number; // 현재까지 넣은 금액(프리플랍 기준)
  lastAction?: string; // "OPEN 3BB", "CALL 3BB" 같은 표시용
  isHero?: boolean;
  anteBB?: number; // ✅ BBA(또는 ante)를 베팅에서 분리 저장
};

export type PreflopSpot = {
  id: string; // 랜덤 ID
  table: TableType;
  phase: TournamentPhase;

  sb: number; // 보통 0.5
  bb: number; // 보통 1
  ante: number; // 예: 0 또는 0.1~1 등. 너 예시에선 1

  heroPos: Position10;
  heroHand: string; // 예: "7s8s" 또는 "AsTd"
  players: PlayerState[];

  // 현재 액션 차례
  toAct: Position10;

  // “콜 비용”과 “지금 팟”
  potBB: number;
  callCostBB: number; // hero가 콜하려면 추가로 내야 하는 금액(이미 invested 제외)

  // 라인 요약(문장)
  lineSummary: string;

    openerPos: Position10;
  openSizeBB: number;
};