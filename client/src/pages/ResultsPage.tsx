import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clearAttempts, loadAttempts } from "../storage";

export default function ResultsPage() {
  const [version, setVersion] = useState(0);

  const attempts = useMemo(() => loadAttempts(), [version]);

  const summary = useMemo(() => {
    const byScenario = new Map<string, { total: number; correct: number; wrongNodes: Set<string> }>();
    for (const a of attempts) {
      const row = byScenario.get(a.scenarioId) ?? { total: 0, correct: 0, wrongNodes: new Set<string>() };
      row.total += 1;
      if (a.isCorrect) row.correct += 1;
      else row.wrongNodes.add(a.nodeId);
      byScenario.set(a.scenarioId, row);
    }
    return [...byScenario.entries()].map(([scenarioId, v]) => ({
      scenarioId,
      total: v.total,
      correct: v.correct,
      acc: v.total === 0 ? 0 : v.correct / v.total,
      wrongCount: v.total - v.correct,
      wrongNodes: [...v.wrongNodes]
    }));
  }, [attempts]);

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Results</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          style={btnOutline}
          onClick={() => {
            if (confirm("Clear all saved attempts?")) {
              clearAttempts();
              setVersion((v) => v + 1);
            }
          }}
        >
          Clear Local Results
        </button>
        <Link to="/">
          <button style={btnOutline}>Back to Scenarios</button>
        </Link>
      </div>

      {summary.length === 0 ? (
        <div style={{ color: "#666" }}>No attempts yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {summary.map((s) => (
            <div key={s.scenarioId} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <b>{s.scenarioId}</b>
                <span><b>{(s.acc * 100).toFixed(0)}%</b></span>
              </div>

              <div style={{ marginTop: 8 }}>
                <div><b>Total:</b> {s.total}</div>
                <div><b>Correct:</b> {s.correct}</div>
                <div><b>Wrong:</b> {s.wrongCount}</div>
              </div>

              <div style={{ marginTop: 10 }}>
                <Link to={`/play/${s.scenarioId}?mode=wrong-only`}>
                  <button style={btn}>Retry wrong only</button>
                </Link>
              </div>

              {s.wrongNodes.length > 0 ? (
                <div style={{ marginTop: 8, color: "#555" }}>
                  <b>Wrong nodes:</b> {s.wrongNodes.join(", ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 12 }}>
        <b>Raw attempts</b>
        <div style={{ marginTop: 8, maxHeight: 260, overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
          {attempts
            .slice()
            .reverse()
            .map((a, i) => (
              <div key={i}>
                {new Date(a.timestamp).toLocaleString()} | {a.scenarioId}/{a.nodeId} | {a.chosenAction}
                {a.chosenSizeBB != null ? `(${a.chosenSizeBB}BB)` : ""} | {a.isCorrect ? "OK" : "NO"}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const btnOutline: React.CSSProperties = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" };
const btn: React.CSSProperties = { padding: "8px 10px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "white" };
