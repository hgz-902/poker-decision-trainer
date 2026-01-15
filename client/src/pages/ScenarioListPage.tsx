import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchScenarioList } from "../api";
import { ScenarioMeta } from "../types";
import { scenarioStats } from "../storage";

export default function ScenarioListPage() {
  const [list, setList] = useState<ScenarioMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScenarioList()
      .then(setList)
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const rows = useMemo(() => {
    return list.map((s) => {
      const st = scenarioStats(s.id);
      return { ...s, ...st };
    });
  }, [list]);

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Scenario List</h3>
      {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        {rows.map((s) => (
          <div key={s.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <b>{s.id}: {s.title}</b>
              <span>⭐ {s.difficulty}</span>
            </div>
            <div style={{ marginTop: 6, color: "#555" }}>{s.tags.join(" · ")}</div>

            <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div><b>Attempts:</b> {s.attempts}</div>
              <div><b>Accuracy:</b> {(s.acc * 100).toFixed(0)}%</div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Link to={`/play/${s.id}`}>
                <button style={btn}>Start</button>
              </Link>
              <Link to={`/play/${s.id}?mode=wrong-only`}>
                <button style={btnOutline}>Review (Wrong only)</button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, color: "#666" }}>
        * MVP: pagination 대신 카드 그리드로 표시합니다.
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { padding: "8px 10px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "white" };
const btnOutline: React.CSSProperties = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" };
