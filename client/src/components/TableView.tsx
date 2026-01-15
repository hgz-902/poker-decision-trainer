import React from "react";
import { Player, Position } from "../types";

function heroPos(players: Player[]): Position | null {
  const h = players.find((p) => p.isUser);
  return h?.pos ?? null;
}

export default function TableView({
  players,
  pot,
  street,
  currentBet,
  toActPos
}: {
  players: Player[];
  pot: number;
  street: string;
  currentBet: number;
  toActPos: string;
}) {
  const hp = heroPos(players);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div><b>Street:</b> {street}</div>
        <div><b>Pot:</b> {pot}BB</div>
        <div><b>Current bet:</b> {currentBet}BB</div>
        <div><b>To act:</b> {toActPos}</div>
      </div>

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Seat</th>
              <th style={th}>Pos</th>
              <th style={th}>Stack(BB)</th>
              <th style={th}>Invested</th>
              <th style={th}>Active</th>
            </tr>
          </thead>
          <tbody>
            {players
              .slice()
              .sort((a, b) => a.seat - b.seat)
              .map((p) => {
                const isHero = p.pos === hp;
                const isToAct = p.pos === toActPos;
                return (
                  <tr key={p.seat} style={{ background: isToAct ? "#fff8dc" : "transparent" }}>
                    <td style={td}>{p.seat}</td>
                    <td style={td}>
                      {p.pos} {isHero ? <b>(You)</b> : null}
                    </td>
                    <td style={td}>{p.stack}</td>
                    <td style={td}>{p.investedThisStreet ?? 0}</td>
                    <td style={td}>{p.active === false ? "OUT" : "IN"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #eee", padding: 8, whiteSpace: "nowrap" };
const td: React.CSSProperties = { borderBottom: "1px solid #f4f4f4", padding: 8, whiteSpace: "nowrap" };
