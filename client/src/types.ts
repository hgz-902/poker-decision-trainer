export type Street = "PREFLOP" | "FLOP" | "TURN" | "RIVER";

export type ActionType = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";

export type GradingMode = "EXACT" | "EXACT_OR_CLOSE";

export type Position =
  | "UTG"
  | "UTG1"
  | "UTG2"
  | "LJ"
  | "HJ"
  | "CO"
  | "BTN"
  | "SB"
  | "BB";

export type Player = {
  seat: number;
  pos: Position;
  stack: number; // in BB
  isUser?: boolean;

  // runtime fields
  active?: boolean;
  investedThisStreet?: number;
  lastAction?: string; // ✅ UI용: "FOLD", "CALL", "RAISE 8BB" 등
};

export type GameState = {
  street: Street;
  board: string[];
  pot: number;
  heroHoleCards: [string, string];
  actionLog: string[];
  toActPos: Position;
  currentBet: number; // amount to match this street
};

export type Scenario = {
  id: string;
  title: string;
  tags: string[];
  difficulty: number;
  table: {
    sb: number;
    bb: number;
    players: Player[];
  };
  initialState: GameState;
  nodes: Node[];
};

export type NodeBase = {
  nodeId: string;
  type: "SCRIPT" | "DECISION";
  street: Street;
  next?: string;
  terminal?: boolean;
};

export type DecisionNode = NodeBase & {
  type: "DECISION";
  prompt: string;
  legalActions: ActionType[];
  raiseOptions?: number[];
  correct: {
    action: ActionType;
    sizeBB?: number;
    grading: GradingMode;
    closeSizesBB?: number[];
  };
  explain: string[];
};

export type ScriptNode = NodeBase & {
  type: "SCRIPT";
  scriptActions: string[];
};

export type Node = DecisionNode | ScriptNode;

export type AttemptResult = {
  scenarioId: string;
  nodeId: string;
  chosenAction: ActionType;
  chosenSizeBB?: number | null;
  isCorrect: boolean;
  timestamp: number;
};

export type ScenarioMeta = {
  id: string;
  title: string;
  tags: string[];
  difficulty: number;
};
