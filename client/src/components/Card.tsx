import React from "react";

type Suit = "s" | "h" | "c" | "d";

function parseCardCode(code: string): { rank: string; suit: Suit; suitSymbol: string; bg: string } {
  const trimmed = code.trim();
  if (trimmed.length < 2) {
    return { rank: "?", suit: "s", suitSymbol: "♠", bg: "#111111" };
  }

  const suitChar = trimmed.slice(-1).toLowerCase() as Suit;
  const rankRaw = trimmed.slice(0, -1).toUpperCase();

  const rank = rankRaw === "T" ? "10" : rankRaw;

  const suitMap: Record<Suit, { symbol: string; bg: string }> = {
    s: { symbol: "♠", bg: "#111111" }, // black
    h: { symbol: "♥", bg: "#d32f2f" }, // red
    c: { symbol: "♣", bg: "#2e7d32" }, // green
    d: { symbol: "♦", bg: "#1565c0" }  // blue
  };

  const v = suitMap[suitChar] ?? suitMap.s;
  return { rank, suit: suitChar, suitSymbol: v.symbol, bg: v.bg };
}

export default function Card({
  code,
  size = "md"
}: {
  code: string;
  size?: "sm" | "md" | "lg";
}) {
  const { rank, suitSymbol, bg } = parseCardCode(code);

  const dims =
    size === "sm"
      ? { w: 34, h: 46, r: 10, fsRank: 12, fsSuit: 18 }
      : size === "lg"
      ? { w: 54, h: 74, r: 14, fsRank: 16, fsSuit: 28 }
      : { w: 44, h: 60, r: 12, fsRank: 14, fsSuit: 22 };

  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: dims.r,
        background: bg,
        color: "white",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none"
      }}
      title={code}
    >
      {/* top-left rank */}
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 7,
          fontSize: dims.fsRank,
          fontWeight: 800,
          lineHeight: 1
        }}
      >
        {rank}
      </div>

      {/* center suit */}
      <div
        style={{
          fontSize: dims.fsSuit,
          fontWeight: 900,
          lineHeight: 1
        }}
      >
        {suitSymbol}
      </div>

      {/* bottom-right suit */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          right: 7,
          fontSize: dims.fsRank,
          fontWeight: 900,
          lineHeight: 1
        }}
      >
        {suitSymbol}
      </div>
    </div>
  );
}
