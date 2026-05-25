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

const PHASE_LABEL: Record<PokerState["phase"], string> = {
  waiting: "Aguardando jogadores",
  preflop: "Pré-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

// Barra de ação enxuta: a mesa, cartas, fichas e jogadores são renderizados
// em 3D na própria mesa do LATIM. Aqui ficam só os controles e o status.
export default function PokerHud({
  state,
  holeCards: _holeCards,
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

  const statusText = (() => {
    if (!state) return "Entrando na mesa…";
    if (!mySeat) return "Assistindo a mesa";
    if (isMyTurn) return toCall > 0 ? `Sua vez · pagar ${toCall}` : "Sua vez · mesa livre";
    if (mySeat.folded) return "Você foldou — aguarde a próxima mão";
    if (mySeat.allIn) return "Você está all-in — aguardando";
    if (state.phase === "waiting") {
      return state.seats.filter((s) => s.playerId).length < 2
        ? "Aguardando outro jogador sentar…"
        : "Próxima mão em alguns segundos…";
    }
    if (state.toActIndex !== null) {
      return `Vez de ${state.seats[state.toActIndex]?.nick ?? "…"}`;
    }
    return PHASE_LABEL[state.phase];
  })();

  const winnerText = useMemo(() => {
    if (!state || state.lastWinners.length === 0) return null;
    return state.lastWinners
      .map((w) => `${w.nick} ganhou ${w.amount} com ${w.handName}`)
      .join(" · ");
  }, [state]);

  return (
    <div
      // Impede que cliques/scroll na barra cheguem ao window (a engine dá
      // preventDefault no mousedown, o que roubava o foco do campo de aumento
      // e disparava o giro de câmera da mesa).
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 50,
        pointerEvents: "auto",
        fontFamily: "ui-sans-serif, system-ui",
        maxWidth: "min(96vw, 720px)",
      }}
    >
      {errorMessage && (
        <div
          onClick={onDismissError}
          style={{
            background: "#5b1c1c",
            border: "1px solid #a93636",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
          }}
          title="Clique para fechar"
        >
          {errorMessage}
        </div>
      )}

      {winnerText && state?.phase === "showdown" && (
        <div
          style={{
            background: "linear-gradient(180deg, #14512f, #0c3d22)",
            border: "1px solid #2f9c5c",
            color: "#eafff0",
            padding: "6px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          }}
        >
          🏆 {winnerText}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "linear-gradient(180deg, rgba(13,42,30,0.96), rgba(8,24,17,0.96))",
          border: "2px solid #1f6b3a",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={onStand}
          title="Levantar da cadeira e sair da mesa"
          style={{
            background: "#a72424",
            color: "#fff",
            border: "1px solid #d24a4a",
            padding: "8px 12px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          🚪 Sair
        </button>

        <div
          style={{
            color: "#e9f5ee",
            fontSize: 13,
            fontWeight: 600,
            minWidth: 120,
            textAlign: "center",
          }}
        >
          <div>{statusText}</div>
          {state && mySeat && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              Pote {state.pot} · suas fichas {mySeat.chips}
            </div>
          )}
        </div>

        {isMyTurn && mySeat && state ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => onAction("fold")} style={btnStyle("#6b2020")}>
              Fold
            </button>
            {toCall === 0 ? (
              <button type="button" onClick={() => onAction("check")} style={btnStyle("#1f6b3a")}>
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
                width: 72,
                padding: "7px 6px",
                borderRadius: 6,
                border: "1px solid #1f6b3a",
                background: "#0a1a14",
                color: "#fff",
                fontSize: 13,
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
              Aumentar
            </button>
            <button
              type="button"
              onClick={() => onAction("allin")}
              disabled={mySeat.chips === 0}
              style={btnStyle("#a06318")}
            >
              All-in
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  };
}
