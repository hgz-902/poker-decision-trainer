import React, { useMemo, useState } from "react";
import { ActionType, DecisionNode } from "../types";

export default function DecisionPanel({
  node,
  disabled,
  onSubmit
}: {
  node: DecisionNode;
  disabled: boolean;
  onSubmit: (action: ActionType, sizeBB?: number | null) => void;
}) {
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [size, setSize] = useState<number | null>(null);

  const needsSize = useMemo(() => selectedAction === "RAISE" || selectedAction === "BET", [selectedAction]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <b>Decision</b>
      <div style={{ marginTop: 8 }}>{node.prompt}</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {node.legalActions.map((a) => (
          <button
            key={a}
            disabled={disabled}
            onClick={() => {
              setSelectedAction(a);
              if (a !== "RAISE" && a !== "BET") setSize(null);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: selectedAction === a ? "#e8f0fe" : "white",
              cursor: disabled ? "not-allowed" : "pointer"
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {needsSize ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6 }}><b>Size (BB)</b></div>

          {node.raiseOptions && node.raiseOptions.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {node.raiseOptions.map((x) => (
                <button
                  key={x}
                  disabled={disabled}
                  onClick={() => setSize(x)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: size === x ? "#e8f0fe" : "white"
                  }}
                >
                  {x}BB
                </button>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 8 }}>
            <input
              disabled={disabled}
              type="number"
              step="0.1"
              value={size ?? ""}
              placeholder="e.g., 2.5"
              onChange={(e) => setSize(e.target.value === "" ? null : Number(e.target.value))}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", width: 160 }}
            />
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <button
          disabled={disabled || !selectedAction || (needsSize && (size == null || !Number.isFinite(size)))}
          onClick={() => onSubmit(selectedAction!, size)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "white" }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
