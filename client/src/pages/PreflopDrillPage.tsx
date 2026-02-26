import React, { useMemo, useState } from "react";
import { generatePreflopSpot } from "../preflop/generator";
import { breakEvenEquity, round2 } from "../preflop/math";
import { PreflopSpot, PlayerState, Position10 } from "../preflop/types";
import { estimateEquityVsRandom, equityDebug, toHandKey } from "../preflop/equityTable";
import { allowedExpansionHand, shoveRangeAllowed } from "../preflop/handRules";

/** ---------------------------
 * Helpers: phase / sizing / 3bet rules
 * -------------------------- */

function formatPhase(p: PreflopSpot["phase"]) {
  switch (p) {
    case "EARLY":
      return "초반";
    case "MID":
      return "중반";
    case "REG_CLOSE_SOON":
      return "레지마감 직전";
    case "REG_CLOSED":
      return "레지마감 후";
    case "BUBBLE":
      return "버블 구간";
    case "PAY_JUMP":
      return "머니점프 구간";
    default:
      return p;
  }
}

function phaseTighteningPP(phase: PreflopSpot["phase"]) {
  // need(필요승률)을 올리는 “추가 마진”
  switch (phase) {
    case "EARLY":
      return 0;
    case "MID":
      return 0.02;
    case "REG_CLOSE_SOON":
      return 0.03;
    case "REG_CLOSED":
      return 0.04;
    case "BUBBLE":
      return 0.08;
    case "PAY_JUMP":
      return 0.10;
    default:
      return 0;
  }
}

function openerStackPenalty(openSize: number, openerStack: number) {
  // 오프너가 오픈 대비 스택이 작을수록(커밋) 레인지가 강해진다고 가정 -> 더 타이트
  const ratio = openerStack / Math.max(0.1, openSize);
  if (ratio <= 6) return 0.08;
  if (ratio <= 10) return 0.05;
  if (ratio <= 15) return 0.03;
  if (ratio <= 25) return 0.01;
  return 0;
}

function heroDeepBonus(openSize: number, heroStack: number, handCode: string) {
  // 딥할수록 “확장 허용 핸드(수딧/포켓)”만 약간 완화(need -)
  const ratio = heroStack / Math.max(0.1, openSize);
  if (!allowedExpansionHand(handCode)) return 0; // 옵숫 확장 금지
  if (ratio >= 30) return 0.03;
  if (ratio >= 20) return 0.02;
  if (ratio >= 15) return 0.01;
  return 0;
}

function isOOP(heroPos: Position10) {
  // MVP 단순화: SB/BB는 OOP
  return heroPos === "SB" || heroPos === "BB";
}

function calc3betSizeBB(openSizeBB: number, heroPos: Position10) {
  // IP: 3x, OOP: 3.5x
  const mult = isOOP(heroPos) ? 3.5 : 3.0;
  return Math.round(openSizeBB * mult * 10) / 10;
}

function isPremiumKey(hk: string) {
  return hk === "AA" || hk === "KK" || hk === "QQ" || hk === "AKs" || hk === "AKo" || hk === "JJ";
}

/**
 * 간단 3bet 레인지 규칙(카테고리 기반, 토너 특성 반영)
 * - 후반(버블/점프): 블러프 3bet 거의 제거, value 위주
 * - 평소: value + 약간의 suited 블러프(한국 토너에서 과하지 않게)
 */
function shouldThreeBetSimple(params: {
  handKey: string; // "KK", "A5s", "KQs", ...
  phase: PreflopSpot["phase"];
  openerVeryShort: boolean;
}) {
  const { handKey, phase, openerVeryShort } = params;

  // 커밋 오프너면 value만
  if (openerVeryShort) {
    return isPremiumKey(handKey) || handKey === "TT" || handKey === "AQs" || handKey === "AQo";
  }

  // 버블/점프: value 위주
  if (phase === "BUBBLE" || phase === "PAY_JUMP") {
    return (
      isPremiumKey(handKey) ||
      handKey === "TT" ||
      handKey === "99" ||
      handKey === "AQs" ||
      handKey === "AQo" ||
      handKey === "AJs" ||
      handKey === "KQs"
    );
  }

  // 기본(초/중/레지): value + 소량 블러프
  if (
    isPremiumKey(handKey) ||
    handKey === "TT" ||
    handKey === "99" ||
    handKey === "AQs" ||
    handKey === "AQo" ||
    handKey === "AJs" ||
    handKey === "KQs"
  ) return true;

  // 블러프 후보(수딧 중심)
  if (handKey === "A5s" || handKey === "A4s" || handKey === "A3s" || handKey === "A2s") return true;
  if (handKey === "KJs" || handKey === "KTs") return true;
  if (handKey === "T9s" || handKey === "98s" || handKey === "87s") return true;

  return false;
}

/** ---------------------------
 * recommendAction: returns consistent shape
 * -------------------------- */

type Rec = {
  action: "FOLD" | "CALL" | "RAISE" | "ALL_IN";
  mode: "PUSH_FOLD" | "NORMAL";
  raiseToBB?: number;

  oppCount: number;

  equity: number;       // base
  equityFinal: number;  // adjusted used for decision
  need: number;         // raw break-even
  needAdj: number;      // adjusted threshold used for decision

  phasePenalty: number;
  openerPenalty: number;
  heroBonus: number;
  shortPenalty: number;

  dbg: { key: string; score: number; eHU: number };

  // debug extras
  openerRatio: number;
  openerVeryShort: boolean;
  isPremium: boolean;
};

function recommendAction(spot: PreflopSpot): Rec {
  const hero = spot.players.find((p) => p.isHero)!;
  const opener = spot.players.find((p) => p.pos === spot.openerPos)!;

  // ✅ inHand 대신 investedBB>0 기준으로 “실제로 돈 낸 사람(프리플랍 참여자)”만 카운트
  //    (현재 generator가 액션 없는 사람을 fold 처리하지 않아서 inHand는 믿으면 안 됨)
  const active = spot.players.filter((p) => (p.investedBB ?? 0) > 0);
  const oppCount = Math.max(1, active.length - 1); // hero 제외
  // 디버깅 필요하면 아래를 UI에 출력해도 좋음
  // const activePos = active.map((p) => p.pos).join(", ");

  const hk = toHandKey(spot.heroHand);
  const isPremium = hk === "AA" || hk === "KK" || hk === "QQ" || hk === "AKs" || hk === "AKo";

  const openSize = Math.max(0.1, spot.openSizeBB);
  const openerRatio = opener.stackBB / openSize;
  const openerVeryShort = opener.stackBB <= 12 || openerRatio <= 6;

  const dbg = equityDebug(spot.heroHand);

  // 공통 값
  const equity = estimateEquityVsRandom(spot.heroHand, oppCount);
  let equityAdj = equity;

  // --- 버블/점프: 오프너가 타이트해진다고 가정 -> 에퀴티 하향(근사) ---
  // ✅ 단, “콜 비용이 작은 방어”에서는 이 하향을 약하게 적용해야 현실적
  const call = spot.callCostBB;

  const callScale =
    call <= 0.5 ? 0.2 :
    call <= 1.0 ? 0.35 :
    call <= 2.0 ? 0.6 :
    1.0;

  if (spot.phase === "BUBBLE" || spot.phase === "PAY_JUMP") {
    const extraRaw =
      openerRatio <= 6 ? 0.08 :
      openerRatio <= 10 ? 0.06 :
      openerRatio <= 15 ? 0.04 :
      0.03;

    const extra = extraRaw * callScale; // ✅ cheap call이면 덜 깎음
    equityAdj = Math.max(0, equityAdj - extra);
  }

  const need = breakEvenEquity(spot.callCostBB, spot.potBB);

  const phasePenalty = phaseTighteningPP(spot.phase);
  const openerPenalty = openerStackPenalty(spot.openSizeBB, opener.stackBB);
  const heroBonus = heroDeepBonus(spot.openSizeBB, hero.stackBB, spot.heroHand);

  // ✅ 페이즈/오프너 페널티도 콜 비용이 작으면 약하게 적용
  const phasePenaltyScaled = phasePenalty * callScale;
  const openerPenaltyScaled = openerPenalty * callScale;

  // 딥 확장은 need를 살짝 낮추고, 페이즈/오프너 커밋은 need를 올린다.
  const needAdj = Math.min(
    0.95,
    Math.max(0, need + phasePenaltyScaled + openerPenaltyScaled - heroBonus)
  );

const margin =
  call <= 0.5 ? 0.003 :   // 0.3%p
  call <= 1.0 ? 0.006 :   // 0.6%p
  call <= 2.0 ? 0.012 :   // 1.2%p
  0.02;                   // 2%p
  const shortPenalty = hero.stackBB <= 20 ? 0.01 : 0;

  // --- 15BB 미만: push/fold 모드 ---
  if (hero.stackBB < 15) {
    const shoveOk = shoveRangeAllowed(spot.heroHand, hero.stackBB);
    const action: Rec["action"] = (isPremium || shoveOk) ? "ALL_IN" : "FOLD";

    return {
      action,
      mode: "PUSH_FOLD",
      raiseToBB: undefined,
      oppCount,
      equity,
      equityFinal: equityAdj, // ✅ 실제 사용값
      need,
      needAdj,
      phasePenalty: phasePenaltyScaled,     // ✅ 스케일링 된 값 반환(설명도 일관)
      openerPenalty: openerPenaltyScaled,   // ✅
      heroBonus,
      shortPenalty: 0,
      dbg,
      openerRatio,
      openerVeryShort,
      isPremium,
    };
  }

  // --- NORMAL: 기본 콜/폴드 ---
  let action: Rec["action"] = equityAdj >= (needAdj + margin + shortPenalty) ? "CALL" : "FOLD";
  let raiseToBB: number | undefined = undefined;

  // 오프너가 커밋이면: 프리미엄만 공격(올인/레이즈), 나머지는 폴드
  if (openerVeryShort) {
    if (isPremium) {
      action = hero.stackBB <= 35 ? "ALL_IN" : "RAISE";
      raiseToBB = action === "RAISE" ? calc3betSizeBB(spot.openSizeBB, spot.heroPos) : undefined;
    } else {
      action = "FOLD";
      raiseToBB = undefined;
    }
  } else {
    // 커밋이 아니면: 3bet 룰 적용
    const threeBet = shouldThreeBetSimple({
      handKey: hk,
      phase: spot.phase,
      openerVeryShort,
    });

    if (threeBet) {
      // 스택이 충분히 있으면 3bet 사이즈
      raiseToBB = calc3betSizeBB(spot.openSizeBB, spot.heroPos);

      // 20BB 이하에서 value(프리미엄/AK)는 리셔브가 더 흔함
      if (hero.stackBB <= 20 && (isPremium || hk === "AKs" || hk === "AKo" || hk === "QQ" || hk === "JJ")) {
        action = "ALL_IN";
        raiseToBB = undefined;
      } else {
        action = "RAISE";
      }
    }
  }

  // 프리미엄 절대 폴드 금지(최종 안전장치)
  if (isPremium && action === "FOLD") {
    action = hero.stackBB <= 20 ? "ALL_IN" : "RAISE";
    raiseToBB = action === "RAISE" ? calc3betSizeBB(spot.openSizeBB, spot.heroPos) : undefined;
  }

  return {
    action,
    mode: "NORMAL",
    raiseToBB,
    oppCount,
    equity,
    equityFinal: equityAdj, // ✅ 실제 사용값
    need,
    needAdj,
    phasePenalty: phasePenaltyScaled,     // ✅ 스케일링 된 값 반환(설명/디버그 일관)
    openerPenalty: openerPenaltyScaled,   // ✅
    heroBonus,
    shortPenalty,
    dbg,
    openerRatio,
    openerVeryShort,
    isPremium,
  };
}

/** ---------------------------
 * Page
 * -------------------------- */

function heroPlayer(spot: PreflopSpot): PlayerState {
  const h = spot.players.find((p) => p.isHero);
  if (!h) throw new Error("Hero not found");
  return h;
}

export default function PreflopDrillPage() {
  const [spot, setSpot] = useState<PreflopSpot>(() => generatePreflopSpot());
  const [choice, setChoice] = useState<"FOLD" | "CALL" | "RAISE" | "ALL_IN" | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const hero = useMemo(() => heroPlayer(spot), [spot]);
  const need = useMemo(() => breakEvenEquity(spot.callCostBB, spot.potBB), [spot]);
  const needPct = useMemo(() => round2(need * 100), [need]);

  const rec = useMemo(() => recommendAction(spot), [spot]);

  const onNewHand = () => {
    setSpot(generatePreflopSpot());
    setChoice(null);
    setSubmitted(false);
  };

  const onSubmit = () => {
    if (!choice) return;
    setSubmitted(true);
  };

  const isCorrect = submitted && choice ? choice === rec.action : null;

  // 버튼 제한 (push/fold)
  const pushFoldMode = hero.stackBB < 15;
  const callDisabled = pushFoldMode || spot.callCostBB <= 0;
  const raiseDisabled = pushFoldMode;

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Preflop Drill</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onNewHand} style={btnOutline}>New spot</button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Left */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Tournament phase</div>
              <div style={{ fontWeight: 800 }}>{formatPhase(spot.phase)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Table</div>
              <div style={{ fontWeight: 800 }}>{spot.table}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Blinds / BBA</div>
              <div style={{ fontWeight: 800 }}>
                SB {spot.sb} / BB {spot.bb} / BBA {spot.ante}
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Hero</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                {spot.heroPos} · {spot.heroHand}
              </div>
              <div style={{ color: "#444", marginTop: 4 }}>
                Stack: <b>{hero.stackBB}BB</b>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Line</div>
              <div style={{ fontWeight: 800 }}>{spot.lineSummary || "(n/a)"}</div>
              <div style={{ color: "#444", marginTop: 6 }}>
                Pot: <b>{spot.potBB}BB</b> · Call cost: <b>{spot.callCostBB}BB</b>
              </div>
              <div style={{ color: "#444", marginTop: 2 }}>
                Break-even equity: <b>{needPct}%</b> (= {spot.callCostBB} / ({spot.potBB}+{spot.callCostBB}))
              </div>
            </div>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />

          <div>
            <div style={{ fontSize: 12, color: "#666" }}>Players (stack / invested / last action)</div>
            <div style={{ marginTop: 8, maxHeight: 260, overflow: "auto", border: "1px solid #eee", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={th}>Pos</th>
                    <th style={th}>Stack</th>
                    <th style={th}>Invested</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spot.players.map((p) => (
                    <tr key={p.pos} style={{ background: p.isHero ? "rgba(33,150,243,0.08)" : "white" }}>
                      <td style={td}><b>{p.pos}</b>{p.isHero ? " (You)" : ""}</td>
                      <td style={td}>{p.stackBB}BB</td>
                      <td style={td}>
  {(p.investedBB ?? 0) - (p.anteBB ?? 0)}BB
  {(p.anteBB ?? 0) > 0 ? ` + ante ${(p.anteBB ?? 0)}BB` : ""}
</td>
                      <td style={td}>{p.lastAction || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              * MVP: 현재는 “오픈 + 콜 몇 명” 중심. 다음 단계에서 3/4/5bet, 셔브 라인을 더 추가합니다.
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={card}>
          <div style={{ fontSize: 12, color: "#666" }}>Decision</div>
          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>
            {spot.heroPos}에서 {spot.heroHand}. 어떻게 할까요?
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={choiceBtn(choice === "FOLD")} onClick={() => setChoice("FOLD")} disabled={submitted}>
              FOLD
            </button>

            <button
              style={choiceBtn(choice === "CALL")}
              onClick={() => setChoice("CALL")}
              disabled={submitted || callDisabled}
              title={callDisabled ? "푸시/폴드 모드이거나 콜 비용이 0입니다." : ""}
            >
              CALL
            </button>

            <button
              style={choiceBtn(choice === "RAISE")}
              onClick={() => setChoice("RAISE")}
              disabled={submitted || raiseDisabled}
              title={raiseDisabled ? "15BB 미만은 푸시/폴드 모드라 레이즈를 연습하지 않습니다." : ""}
            >
              {rec.raiseToBB ? `RAISE to ${rec.raiseToBB}BB` : "RAISE"}
            </button>

            <button style={choiceBtn(choice === "ALL_IN")} onClick={() => setChoice("ALL_IN")} disabled={submitted}>
              ALL-IN
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={onSubmit} style={btnPrimary} disabled={!choice || submitted}>
              Submit
            </button>
          </div>

          {submitted ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {isCorrect ? "✅ Correct" : "❌ Not the expected answer"}
              </div>

              <div style={{ marginTop: 8 }}>
                <div><b>Your choice:</b> {choice}</div>
                <div>
                  <b>Recommended:</b> {rec.action}
                  {rec.action === "RAISE" && rec.raiseToBB ? ` (to ${rec.raiseToBB}BB)` : ""}
                </div>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "10px 0" }} />

              <div style={{ fontWeight: 900 }}>Explanation (Beginner-friendly)</div>
              <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                <p style={{ margin: "6px 0" }}>
                  이 문제는 <b>“콜 비용 대비, 이길 확률(에퀴티)이 충분한가?”</b>를 보는 훈련이에요.
                </p>
                <p style={{ margin: "6px 0" }}>
                  1) 먼저 <b>팟 오즈</b>로 “최소 필요 승률”을 만들고,
                  2) 내 핸드가 이길 확률(에퀴티)을 <b>근사 테이블</b>로 추정한 뒤,
                  3) <b>필요 승률보다 충분히 높으면 콜</b>, 부족하면 <b>폴드</b>가 기본입니다.
                </p>
                <p style={{ margin: "6px 0" }}>
                  토너먼트 후반(특히 버블/머니점프)에서는 위험 회피 때문에 더 보수적으로 평가합니다.
                  또한 상대가 <b>커밋(짧은 스택)</b>에 가깝다면 레인지가 강하다고 가정하여 더 타이트하게 판단합니다.
                </p>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "12px 0" }} />

              <div style={{ fontWeight: 900 }}>Calculation details (MVP)</div>
              <ul style={{ marginTop: 8 }}>
                <li>
                  Pot = <b>{spot.potBB}BB</b>, Call cost = <b>{spot.callCostBB}BB</b>
                </li>
                <li>
                  Break-even equity (raw) = <b>{round2(rec.need * 100)}%</b>
                </li>
                <li>
                  Adjusted break-even (needAdj) = <b>{round2(rec.needAdj * 100)}%</b>{" "}
                  (phase + opener - heroDeep)
                </li>
                <li>
                  Equity (base) = <b>{round2(rec.equity * 100)}%</b>, Equity (final) ={" "}
                  <b>{round2(rec.equityFinal * 100)}%</b>{" "}
                  (HU baseline {round2(rec.dbg.eHU * 100)}%, key {rec.dbg.key}, score {rec.dbg.score})
                </li>
                <li>
                  Opponents = <b>{rec.oppCount}</b>, opener ratio(stack/open) ={" "}
                  <b>{round2(rec.openerRatio)}x</b>
                </li>
                <li>
                  Penalties: phase <b>{round2(rec.phasePenalty * 100)}%</b>p, opener{" "}
                  <b>{round2(rec.openerPenalty * 100)}%</b>p, short{" "}
                  <b>{round2(rec.shortPenalty * 100)}%</b>p, heroDeep bonus{" "}
                  <b>{round2(rec.heroBonus * 100)}%</b>p
                </li>
                <li>
                  Mode: <b>{rec.mode}</b> (push/fold if hero &lt; 15BB)
                </li>
              </ul>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button onClick={onNewHand} style={btnOutline}>Next spot</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
              * 15BB 미만은 푸시/폴드 모드로 콜/레이즈를 제한합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ---------------------------
 * Styles
 * -------------------------- */

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 12,
  background: "white",
};

const btnOutline: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "white",
  cursor: "pointer",
};

function choiceBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: active ? "2px solid #111" : "1px solid #ccc",
    background: active ? "rgba(0,0,0,0.06)" : "white",
    cursor: "pointer",
    fontWeight: 800,
  };
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 12,
  borderBottom: "1px solid #eee",
  color: "#555",
};

const td: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  borderBottom: "1px solid #f2f2f2",
};