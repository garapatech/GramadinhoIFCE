"use client";

import { useMemo, useState } from "react";
import type { SocketInboundMessage } from "@/shared/schemas/multiplayer";

type ChessState = Extract<SocketInboundMessage, { type: "chess-state" }>["state"];
type Square = { file: number; rank: number };

type Props = {
  state: ChessState | null;
  localId: string | null;
  errorMessage: string | null;
  onSit: (color: "w" | "b") => void;
  onStand: () => void;
  onMove: (from: Square, to: Square) => void;
  onReset: () => void;
  onDismissError: () => void;
};

const PIECE_GLYPH: Record<string, string> = {
  wP: "♙", wN: "♘", wB: "♗", wR: "♖", wQ: "♕", wK: "♔",
  bP: "♟", bN: "♞", bB: "♝", bR: "♜", bQ: "♛", bK: "♚",
};

function squareLabel(sq: Square) {
  return `${"abcdefgh"[sq.file]}${sq.rank + 1}`;
}

export default function ChessHud({
  state,
  localId,
  errorMessage,
  onSit,
  onStand,
  onMove,
  onReset,
  onDismissError,
}: Props) {
  const [selected, setSelected] = useState<Square | null>(null);

  const mySeat = useMemo(() => {
    if (!state || !localId) return null;
    return state.seats.find((s) => s.playerId === localId) ?? null;
  }, [state, localId]);

  if (!state) return null;

  const isMyTurn = !!mySeat && state.phase === "playing" && state.turn === mySeat.color;

  // Orienta tabuleiro: brancas embaixo, pretas em cima. Se for jogador preto,
  // inverte pra mostrar o lado dele embaixo.
  const flipForBlack = mySeat?.color === "b";
  const ranksOrder = flipForBlack ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const filesOrder = flipForBlack ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  function squareKey(sq: Square) {
    return `${sq.file},${sq.rank}`;
  }

  function handleCellClick(file: number, rank: number) {
    if (!mySeat) return;
    const sq = { file, rank };
    const piece = state.board[rank][file];
    if (selected) {
      if (selected.file === file && selected.rank === rank) {
        setSelected(null);
        return;
      }
      // Se clicar em outra peca propria, troca selecao
      if (piece && piece.color === mySeat.color) {
        setSelected(sq);
        return;
      }
      // Tenta mover
      onMove(selected, sq);
      setSelected(null);
      return;
    }
    // Sem selecao: seleciona se peca propria
    if (piece && piece.color === mySeat.color && isMyTurn) {
      setSelected(sq);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        width: 440,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)",
        color: "#f3f3f3",
        border: "2px solid #5a5a7a",
        borderRadius: 10,
        padding: 14,
        fontFamily: "ui-sans-serif, system-ui",
        fontSize: 13,
        zIndex: 50,
        boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ fontSize: 15 }}>Xadrez • LATIM</strong>
        {mySeat && (
          <button
            type="button"
            onClick={onStand}
            title="Levantar da mesa"
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
            🚪 Sair
          </button>
        )}
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

      {!mySeat && (
        <div style={{ marginBottom: 10, fontSize: 12 }}>
          Escolha um lado pra jogar:
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => onSit("w")}
              disabled={!!state.seats[0].playerId}
              style={sitBtnStyle("#e8e8e8", "#111")}
            >
              ♔ Brancas {state.seats[0].playerId ? `(${state.seats[0].nick})` : ""}
            </button>
            <button
              type="button"
              onClick={() => onSit("b")}
              disabled={!!state.seats[1].playerId}
              style={sitBtnStyle("#222", "#fff")}
            >
              ♚ Pretas {state.seats[1].playerId ? `(${state.seats[1].nick})` : ""}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
        <span>
          Vez: <strong>{state.turn === "w" ? "Brancas" : "Pretas"}</strong>
          {state.inCheck ? " (xeque)" : ""}
        </span>
        <span>
          {state.phase === "waiting"
            ? "Aguardando 2 jogadores"
            : state.phase === "playing"
              ? mySeat ? (isMyTurn ? "Sua vez" : "Adversário") : "Em jogo"
              : state.result === "draw"
                ? "Empate"
                : `${state.result === "white" ? "Brancas" : "Pretas"} venceram`}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 44px)",
          gridTemplateRows: "repeat(8, 44px)",
          gap: 0,
          border: "2px solid #2c2c40",
          width: "fit-content",
          margin: "8px auto",
        }}
      >
        {ranksOrder.map((r) =>
          filesOrder.map((f) => {
            const piece = state.board[r][f];
            const isSelected = selected && selected.file === f && selected.rank === r;
            const isLight = (r + f) % 2 === 1;
            const isMine = piece && mySeat && piece.color === mySeat.color;
            return (
              <div
                key={`${r}-${f}`}
                onClick={() => handleCellClick(f, r)}
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  background: isSelected
                    ? "#dba12a"
                    : isLight ? "#e8d3a0" : "#7a5a3a",
                  color: piece?.color === "w" ? "#f8f8f8" : "#1a1a1a",
                  cursor: mySeat ? "pointer" : "default",
                  userSelect: "none",
                  outline: isSelected ? "2px solid #f9c43b" : "none",
                  textShadow: piece?.color === "w"
                    ? "0 1px 1px rgba(0,0,0,0.6)"
                    : "0 1px 1px rgba(255,255,255,0.4)",
                }}
                title={`${squareLabel({ file: f, rank: r })}${piece ? ` ${piece.color}${piece.kind}` : ""}`}
              >
                {piece ? PIECE_GLYPH[`${piece.color}${piece.kind}`] : ""}
              </div>
            );
          })
        )}
      </div>

      {(state.capturedByWhite.length > 0 || state.capturedByBlack.length > 0) && (
        <div style={{ fontSize: 18, display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>
            Brancas tomaram:{" "}
            {state.capturedByWhite.map((k, i) => (
              <span key={i}>{PIECE_GLYPH[`b${k}`]}</span>
            ))}
          </span>
          <span>
            Pretas tomaram:{" "}
            {state.capturedByBlack.map((k, i) => (
              <span key={i}>{PIECE_GLYPH[`w${k}`]}</span>
            ))}
          </span>
        </div>
      )}

      {state.phase === "ended" && (
        <div style={{ background: "#23232f", padding: "6px 8px", borderRadius: 4, marginBottom: 6 }}>
          <strong>Fim:</strong> {state.resultReason}{" "}
          {state.result && state.result !== "draw" &&
            `(${state.result === "white" ? "brancas" : "pretas"})`}
          <button
            type="button"
            onClick={onReset}
            style={{
              marginLeft: 10,
              background: "#2a6e3f", color: "#fff", border: "none",
              padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12,
            }}
          >
            Nova partida
          </button>
        </div>
      )}

      {state.moves.length > 0 && (
        <details style={{ fontSize: 11, opacity: 0.85 }}>
          <summary style={{ cursor: "pointer" }}>Histórico ({state.moves.length} lances)</summary>
          <div style={{ maxHeight: 100, overflowY: "auto", marginTop: 4 }}>
            {state.moves.map((m, i) => (
              <div key={i}>
                {i + 1}. {m.san}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function sitBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    border: "1px solid #555",
    padding: "6px 10px",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 13,
    flex: 1,
  };
}
