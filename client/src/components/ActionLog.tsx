import React from "react";

export default function ActionLog({ lines }: { lines: string[] }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, height: 220, overflow: "auto" }}>
      <b>Action Log</b>
      <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13 }}>
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
