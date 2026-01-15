import React, { useMemo } from "react";
import { Player, Position } from "../types";
import Card from "./Card";
import { useScaleToFit } from "../hooks/useScaleToFit";
import "./PokerTable.css";




function shortPosLabel(pos: Position) {
  return pos;
}

function actionBadgeStyle(text: string): React.CSSProperties {
  const t = text.toUpperCase();

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.25)",
    color: "white",
    whiteSpace: "nowrap",
    boxShadow: "0 8px 18px rgba(0,0,0,0.22)"
  };

  if (t.startsWith("POST")) return { ...base, background: "rgba(0, 150, 136, 0.92)" }; // teal for blinds/antes
  if (t.startsWith("FOLD")) return { ...base, background: "rgba(120,120,120,0.9)" };
  if (t.startsWith("CALL") || t.startsWith("CHECK")) return { ...base, background: "rgba(25,118,210,0.9)" };
  if (t.startsWith("RAISE") || t.startsWith("BET")) return { ...base, background: "rgba(245,124,0,0.92)" };
  if (t.startsWith("ALL-IN")) return { ...base, background: "rgba(211,47,47,0.92)" };
  return { ...base, background: "rgba(80,80,80,0.9)" };
}

function heroPos(players: Player[]): Position | null {
  return players.find((p) => p.isUser)?.pos ?? null;
}

export default function PokerTable({
  players,
  board,
  heroHoleCards,
  pot,
  currentBet,
  toActPos
}: {
  players: Player[];
  board: string[];
  heroHoleCards: [string, string];
  pot: number;
  currentBet: number;
  toActPos: Position;
}) {
  const sorted = useMemo(() => players.slice().sort((a, b) => a.seat - b.seat), [players]);
  const hpos = useMemo(() => heroPos(players), [players]);
    const BASE_W = 980;
const BASE_H = 520;
const { outerRef, scale } = useScaleToFit(BASE_W);

  const seatCoords = useMemo(() => {
    const coords: Array<{ leftPct: number; topPct: number }> = [];
    const cx = 50;
    const cy = 50;
    const rx = 42;
    const ry = 34;
    for (let i = 0; i < 9; i++) {
      const angleDeg = -90 + i * (360 / 9);
      const rad = (angleDeg * Math.PI) / 180;
      coords.push({
        leftPct: cx + rx * Math.cos(rad),
        topPct: cy + ry * Math.sin(rad)
      });
    }
    return coords;
  }, []);

  const centerBoard = board ?? [];

  return (
    <div className="pdt-table-outer" ref={outerRef}>
    <div
      className="pdt-table-scaleSpacer"
      style={{ height: `${BASE_H * scale}px` }}
    >
      <div
        className="pdt-table-scaleWrap"
        style={{
          width: `${BASE_W}px`,
          height: `${BASE_H}px`,
          transform: `scale(${scale})`,
        }}
      >
    <div style={{ border: "1px solid #ddd", borderRadius: 14, padding: 12, overflow: "hidden" }}>
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ color: "#555" }}>
          <b>Table UI</b> · Seats: {players.length} · To act: <b>{toActPos}</b>
        </div>
        <div style={{ color: "#555" }}>
          <b>Pot:</b> {pot}BB · <b>Current bet:</b> {currentBet}BB
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 520,
          borderRadius: 16,
          background: "radial-gradient(circle at 50% 40%, #1f6a3a 0%, #0f3e25 55%, #0b2c1a 100%)",
          border: "2px solid rgba(255,255,255,0.08)"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 16,
            borderRadius: 999,
            border: "2px solid rgba(0,0,0,0.35)",
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.06)"
          }}
        />

        {/* center: board + hero */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(720px, 92%)",
            textAlign: "center"
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            {centerBoard.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>Board: (not dealt)</div>
            ) : (
              <>
                {centerBoard.map((c, idx) => (
                  <Card key={idx} code={c} size="lg" />
                ))}
              </>
            )}
          </div>

          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              gap: 10,
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              fontWeight: 800
            }}
          >
            <span>Pot {pot}BB</span>
            <span style={{ opacity: 0.6 }}>|</span>
            <span>Bet {currentBet}BB</span>
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 800 }}>Hero</span>
            <Card code={heroHoleCards[0]} size="lg" />
            <Card code={heroHoleCards[1]} size="lg" />
          </div>
        </div>

        {/* Seats */}
        {sorted.map((p, idx) => {
          const coord = seatCoords[idx] ?? { leftPct: 50, topPct: 50 };
          const isHero = p.pos === hpos;
          const isToAct = p.pos === toActPos;
          const isOut = p.active === false;

          return (
            <div
              key={p.seat}
              style={{
                position: "absolute",
                left: `${coord.leftPct}%`,
                top: `${coord.topPct}%`,
                transform: "translate(-50%, -50%)",
                width: 170
              }}
            >
              {/* ✅ 배지는 OUT이어도 잘 보이게(이 wrapper에는 opacity 적용 안 함) */}
              {p.lastAction ? (
                <div style={{ position: "absolute", left: "50%", top: -14, transform: "translate(-50%, -100%)" }}>
                  <span style={actionBadgeStyle(p.lastAction)}>{p.lastAction}</span>
                </div>
              ) : null}

              {/* seat card (여기만 OUT이면 흐리게) */}
              <div
                style={{
                  borderRadius: 14,
                  padding: 10,
                  background: isToAct ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.22)",
                  border: isToAct ? "2px solid rgba(255,255,255,0.55)" : "1px solid rgba(255,255,255,0.14)",
                  boxShadow: isToAct ? "0 0 0 3px rgba(255,255,255,0.12)" : "none",
                  color: "white",
                  opacity: isOut ? 0.35 : 1
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ fontWeight: 900 }}>
                    {shortPosLabel(p.pos)} {isHero ? "(You)" : ""}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.12)"
                    }}
                  >
                    Seat {p.seat}
                  </div>
                </div>

                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <div style={{ opacity: 0.9 }}>
                    <div style={{ fontWeight: 800 }}>Stack</div>
                    <div>{p.stack}BB</div>
                  </div>
                  <div style={{ opacity: 0.9 }}>
                    <div style={{ fontWeight: 800 }}>Invested</div>
                    <div>{p.investedThisStreet ?? 0}BB</div>
                  </div>
                  <div style={{ opacity: 0.9, textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>Status</div>
                    <div>{isOut ? "OUT" : "IN"}</div>
                  </div>
                </div>

                {isHero ? (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.28)",
                        border: "1px solid rgba(255,255,255,0.12)"
                      }}
                    >
                      Hero seat
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
        * 초기 Action Log(블라인드/폴드)를 파싱해서 좌석 상태에 반영합니다.
      </div>
    </div>
    </div>
    </div>
    </div>
  );
}
