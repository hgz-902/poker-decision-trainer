import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchScenario } from "../api";
import { DecisionNode, Node, Scenario } from "../types";
import ActionLog from "../components/ActionLog";
import DecisionPanel from "../components/DecisionPanel";
import ResultModal from "../components/ResultModal";
import PokerTable from "../components/PokerTable";
import {
  applyScriptNode,
  applyUserDecisionToState,
  gradeDecision,
  initRuntime,
  makeAttemptResult,
  Runtime
} from "../engine/engine";
import { loadAttempts, saveAttempt } from "../storage";

export default function PlayPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const modeWrongOnly = params.get("mode") === "wrong-only";

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [rt, setRt] = useState<Runtime | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean>(false);
  const [lastExplain, setLastExplain] = useState<string[]>([]);

  const wrongNodeIdSet = useMemo(() => {
    if (!id) return new Set<string>();
    const all = loadAttempts().filter((x) => x.scenarioId === id);
    const wrong = all.filter((x) => !x.isCorrect).map((x) => x.nodeId);
    return new Set(wrong);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchScenario(id)
      .then((s) => {
        setScenario(s);
        const runtime = initRuntime(s);
        setRt(runtime);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [id]);

  useEffect(() => {
    if (!rt) return;
    runUntilDecision(rt, modeWrongOnly ? wrongNodeIdSet : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt, modeWrongOnly]);

  const currentNode: Node | null = useMemo(() => {
    if (!rt) return null;
    return rt.nodeById.get(rt.currentNodeId) ?? null;
  }, [rt]);

  if (error) return <div style={{ color: "crimson" }}>{error}</div>;
  if (!scenario || !rt || !currentNode) return <div>Loading...</div>;

  const isUserTurn = currentNode.type === "DECISION";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
          {scenario.id}: {scenario.title} {modeWrongOnly ? "(Wrong-only)" : ""}
        </h3>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnOutline} onClick={() => navigate("/")}>
            Back
          </button>
          <Link to="/results">
            <button style={btnOutline}>Results</button>
          </Link>
        </div>
      </div>

      <PokerTable
        players={rt.players}
        board={rt.state.board}
        heroHoleCards={rt.state.heroHoleCards}
        pot={rt.state.pot}
        currentBet={rt.state.currentBet}
        toActPos={rt.state.toActPos}
      />

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <ActionLog lines={rt.state.actionLog} />

        <div>
          {currentNode.type === "DECISION" ? (
            <DecisionPanel
              node={currentNode as DecisionNode}
              disabled={!isUserTurn || modalOpen}
              onSubmit={(action, sizeBB) => {
                const node = currentNode as DecisionNode;
                const isCorrect = gradeDecision(node, action, sizeBB ?? null);

                applyUserDecisionToState(rt, node, action, sizeBB ?? null);

                saveAttempt(makeAttemptResult(scenario.id, node.nodeId, action, sizeBB ?? null, isCorrect));

                setLastCorrect(isCorrect);
                setLastExplain(node.explain);
                setModalOpen(true);

                setRt({
                  ...rt,
                  players: [...rt.players],
                  state: { ...rt.state, actionLog: [...rt.state.actionLog] }
                });
              }}
            />
          ) : (
            <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <b>Auto-playing script...</b>
            </div>
          )}

          <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
            * Decision은 오른쪽 패널에서 하고, 테이블 위에서는 포지션/액션 배지를 확인할 수 있어요.
          </div>
        </div>
      </div>

      <ResultModal
        open={modalOpen}
        isCorrect={lastCorrect}
        explain={lastExplain}
        onClose={() => {
          setModalOpen(false);

          const n = rt.nodeById.get(rt.currentNodeId);
          const nextId = n?.next;

          // ✅ terminal Decision은 "답을 제출하고" 모달 닫았을 때 여기로 들어옴.
          // 이때 next가 없으면 결과로 이동하는 게 맞다.
          if (!nextId) {
            navigate("/results");
            return;
          }

          // 다음 노드로 진행
          rt.currentNodeId = nextId;
          runUntilDecision(rt, modeWrongOnly ? wrongNodeIdSet : null);

          setRt({
            ...rt,
            players: [...rt.players],
            state: { ...rt.state, actionLog: [...rt.state.actionLog] }
          });

          // ❌ 여기서 terminal 여부로 results로 보내면 안 됨(턴 문제의 원인)
          // (삭제됨)
        }}
      />
    </div>
  );
}

function runUntilDecision(rt: Runtime, wrongOnlySet: Set<string> | null) {
  while (true) {
    const node = rt.nodeById.get(rt.currentNodeId);
    if (!node) return;

    if (node.type === "SCRIPT") {
      applyScriptNode(rt, node.nodeId);
      if (!node.next) return;
      rt.currentNodeId = node.next;
      continue;
    }

    if (wrongOnlySet && wrongOnlySet.size > 0) {
      if (!wrongOnlySet.has(node.nodeId)) {
        if (!node.next) return;
        rt.currentNodeId = node.next;
        continue;
      }
    }

    return;
  }
}

const btnOutline: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white"
};
