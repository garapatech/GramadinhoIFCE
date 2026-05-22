"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  pokerCardSchema,
  pokerPublicStateSchema,
} from "@/shared/schemas/multiplayer";
import { z } from "zod";

type Card = z.infer<typeof pokerCardSchema>;
type PokerState = z.infer<typeof pokerPublicStateSchema>;

type Props = {
  state: PokerState | null;
  holeCards: Card[] | null;
  localId: string | null;
  errorMessage: string | null;
  onStand: () => void;
  onAction: (
    action: "fold" | "check" | "call" | "raise" | "allin",
    amount?: number,
  ) => void;
  onDismissError: () => void;
};

function rankLabel(rank: number): string {
  if (rank === 14) return "A";
  if (rank === 13) return "K";
  if (rank === 12) return "Q";
  if (rank === 11) return "J";
  return String(rank);
}

function suitGlyph(suit: Card["suit"]): { glyph: string; color: string } {
  if (suit === "H") return { glyph: "♥", color: "#d4221f" };
  if (suit === "D") return { glyph: "♦", color: "#d4221f" };
  if (suit === "S") return { glyph: "♠", color: "#111" };
  return { glyph: "♣", color: "#111" };
}

function CardView({ card, hidden }: { card: Card | null; hidden?: boolean }) {
  if (!card || hidden) {
    return (
      <div
        style={{
          width: 38,
          height: 54,
          borderRadius: 5,
          background:
            "repeating-linear-gradient(45deg, #6f1414 0 6px, #8c1c1c 6px 12px)",
          border: "1px solid #2a0a0a",
          boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
        }}
      />
    );
  }
  const { glyph, color } = suitGlyph(card.suit);
  return (
    <div
      style={{
        width: 38,
        height: 54,
        borderRadius: 5,
        background: "#fafafa",
        border: "1px solid #888",
        boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color,
        fontWeight: 700,
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{rankLabel(card.rank)}</span>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{glyph}</span>
    </div>
  );
}

function CardRow({ cards, padTo, hideAll }: { cards: Card[]; padTo?: number; hideAll?: boolean }) {
  const slots: (Card | null)[] = cards.slice();
  if (padTo) while (slots.length < padTo) slots.push(null);
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {slots.map((c, i) => (
        <CardView key={i} card={c} hidden={hideAll === true} />
      ))}
    </div>
  );
}

const PHASE_LABEL: Record<PokerState["phase"], string> = {
  waiting: "Aguardando jogadores",
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

export default function PokerHud({
  state,
  holeCards,
  localId,
  errorMessage,
  onStand,
  onAction,
  onDismissError,
}: Props) {
  const mySeat = useMemo(() => {
    if (!state || !localId) return null;
    return state.seats.find((s) => s.playerId === localId) ?? null;
  }, [state, localId]);

  const toCall = useMemo(() => {
    if (!state || !mySeat) return 0;
    return Math.max(0, state.currentBet - mySeat.betThisRound);
  }, [state, mySeat]);

  const isMyTurn =
    !!state && !!mySeat && state.toActIndex === mySeat.index &&
    state.phase !== "waiting" && state.phase !== "showdown" &&
    !mySeat.folded && !mySeat.allIn;

  const minRaiseTotal = useMemo(() => {
    if (!state) return 0;
    return state.currentBet + state.minRaise;
  }, [state]);

  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  useEffect(() => {
    setRaiseAmount(minRaiseTotal);
  }, [minRaiseTotal]);

  if (!state || !mySeat) return null;

  const otherSeats = state.seats.filter((s) => s.playerId && s.index !== mySeat.index);

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 360,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        background: "linear-gradient(180deg, #0d2a1e 0%, #0a1a14 100%)",
        color: "#f3f3f3",
        border: "2px solid #1f6b3a",
        borderRadius: 10,
        padding: 14,
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: 13,
        zIndex: 50,
        boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
        // O .game-overlay pai tem pointer-events: none — precisamos opt-in.
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ fontSize: 15 }}>Pôquer • LATIM</strong>
        <button
          type="button"
          onClick={onStand}
          title="Levantar da cadeira e sair da mesa"
          style={{
            background: "#a72424",
            color: "#fff",
            border: "1px solid #d24a4a",
            padding: "6px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}
        >
          🚪 Sair da mesa
        </button>
      </div>
      <div
        style={{
          fontSize: 11,
          opacity: 0.75,
          marginBottom: 10,
          textAlign: "right",
        }}
      >
        clique em <strong>Sair da mesa</strong> a qualquer momento pra levantar
      </div>

      {errorMessage && (
        <div
          onClick={onDismissError}
          style={{
            background: "#5b1c1c", border: "1px solid #a93636",
            padding: "6px 8px", borderRadius: 4, marginBottom: 8, cursor: "pointer",
          }}
          title="Clique para fechar"
        >
          {errorMessage}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
        <span>{PHASE_LABEL[state.phase]}</span>
        <span>Pote: <strong>{state.pot}</strong></span>
        <span>Aposta: {state.currentBet}</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Mesa</div>
        <CardRow cards={state.community} padTo={5} />
      </div>

      <div style={{ marginBottom: 10, paddingTop: 8, borderTop: "1px solid #1f4a32" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>
            Você (assento {mySeat.index + 1})
            {state.dealerIndex === mySeat.index ? " 🎯" : ""}
          </span>
          <span>Fichas: <strong>{mySeat.chips}</strong></span>
        </div>
        <CardRow cards={holeCards ?? mySeat.showCards ?? []} padTo={2} />
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
          Aposta nesta rodada: {mySeat.betThisRound}
          {mySeat.folded ? " — foldou" : ""}
          {mySeat.allIn ? " — all-in" : ""}
        </div>
      </div>

      {otherSeats.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Outros jogadores</div>
          {otherSeats.map((s) => (
            <div
              key={s.index}
              style={{
                display: "flex", justifyContent: "space-between",
                padding: "4px 6px", borderRadius: 4,
                background: state.toActIndex === s.index ? "#1f4a32" : "transparent",
                marginBottom: 2, fontSize: 12,
              }}
            >
              <span>
                {s.nick || `Assento ${s.index + 1}`}
                {state.dealerIndex === s.index ? " 🎯" : ""}
                {s.folded ? " · fold" : s.allIn ? " · all-in" : ""}
              </span>
              <span>
                {s.chips}f
                {s.betThisRound > 0 ? ` (+${s.betThisRound})` : ""}
              </span>
              {s.showCards && s.showCards.length > 0 ? (
                <CardRow cards={s.showCards} padTo={2} />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {state.lastWinners.length > 0 && (
        <div style={{ background: "#13402a", padding: "6px 8px", borderRadius: 4, marginBottom: 10, fontSize: 12 }}>
          <strong>Resultado:</strong>
          {state.lastWinners.map((w, i) => (
            <div key={i}>
              {w.nick} ganhou {w.amount} com {w.handName}
            </div>
          ))}
        </div>
      )}

      {isMyTurn ? (
        <div style={{ paddingTop: 8, borderTop: "1px solid #1f4a32" }}>
          <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 6 }}>
            Sua vez {toCall > 0 ? `· pagar ${toCall} pra continuar` : "· mesa livre"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onAction("fold")}
              style={btnStyle("#6b2020")}
            >
              Fold
            </button>
            {toCall === 0 ? (
              <button
                type="button"
                onClick={() => onAction("check")}
                style={btnStyle("#1f6b3a")}
              >
                Mesa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAction("call")}
                disabled={mySeat.chips === 0}
                style={btnStyle("#1f6b3a")}
              >
                Pagar {Math.min(toCall, mySeat.chips)}
              </button>
            )}
            <button
              type="button"
              onClick={() => onAction("allin")}
              disabled={mySeat.chips === 0}
              style={btnStyle("#a06318")}
            >
              All-in
            </button>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="number"
              value={raiseAmount}
              min={minRaiseTotal}
              max={mySeat.chips + mySeat.betThisRound}
              step={Math.max(1, state.bigBlind)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setRaiseAmount(Number.isFinite(v) ? v : 0);
              }}
              style={{
                width: 80, padding: "4px 6px", borderRadius: 4,
                border: "1px solid #1f6b3a", background: "#0a1a14", color: "#fff",
              }}
            />
            <button
              type="button"
              onClick={() => onAction("raise", raiseAmount)}
              disabled={
                raiseAmount < minRaiseTotal ||
                raiseAmount > mySeat.chips + mySeat.betThisRound
              }
              style={btnStyle("#2459a8")}
            >
              Aumentar para {raiseAmount}
            </button>
          </div>
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
            Mínimo: {minRaiseTotal} · Máximo: {mySeat.chips + mySeat.betThisRound}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, opacity: 0.7, paddingTop: 6 }}>
          {mySeat.folded
            ? "Você foldou — aguarde a próxima mão."
            : mySeat.allIn
              ? "Você está all-in — aguardando."
              : state.phase === "waiting"
                ? state.seats.filter((s) => s.playerId).length < 2
                  ? "Aguardando outro jogador sentar..."
                  : "Próxima mão em alguns segundos..."
                : state.toActIndex !== null
                  ? `Vez de ${state.seats[state.toActIndex]?.nick ?? "..."}`
                  : "Aguardando ação..."}
        </div>
      )}

      {state.log.length > 0 && (
        <details style={{ marginTop: 10, fontSize: 11, opacity: 0.85 }}>
          <summary style={{ cursor: "pointer" }}>Histórico</summary>
          <div style={{ maxHeight: 120, overflowY: "auto", marginTop: 4 }}>
            {state.log.slice(-12).map((entry, i) => (
              <div key={i}>· {entry}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  };
}
