import React from "react";

export default function ResultModal({
  open,
  isCorrect,
  explain,
  onClose
}: {
  open: boolean;
  isCorrect: boolean;
  explain: string[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginTop: 0 }}>{isCorrect ? "✅ Correct" : "❌ Incorrect"}</h3>
        <div style={{ marginBottom: 12 }}>
          {explain.map((x, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              • {x}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "white" }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16
};

const modal: React.CSSProperties = {
  width: "min(560px, 100%)",
  background: "white",
  borderRadius: 12,
  padding: 16,
  border: "1px solid #ddd"
};
