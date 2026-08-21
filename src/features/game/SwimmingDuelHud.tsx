"use client";

import { useEffect, useState } from "react";
import type { SocketInboundMessage } from "@/shared/schemas/multiplayer";

type SwimScore = Extract<SocketInboundMessage, { type: "swim-progress" }>["scores"][number];

export type SwimmingDuelState =
  | { phase: "incoming"; matchId: string; from: string; fromNick: string }
  | {
      phase: "active";
      matchId: string;
      playerA: string;
      playerB: string;
      nickA: string;
      nickB: string;
      startAt: number;
      endAt: number;
      scores: SwimScore[];
    }
  | {
      phase: "ended";
      matchId: string;
      scores: SwimScore[];
      winnerId: string | null;
      tie: boolean;
      reason: string;
    };

type Props = {
  state: SwimmingDuelState | null;
  localId: string | null;
  getServerNow: () => number;
  onAccept: () => void;
  onDecline: () => void;
  onQuit: () => void;
  onDismiss: () => void;
};

export default function SwimmingDuelHud({
  state,
  localId,
  getServerNow,
  onAccept,
  onDecline,
  onQuit,
  onDismiss,
}: Props) {
  const [, redraw] = useState(0);

  useEffect(() => {
    if (state?.phase !== "active") return;
    const timer = window.setInterval(() => redraw((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [state?.phase]);

  if (!state) return null;
  if (state.phase === "incoming") {
    return (
      <div className="activity-overlay" role="dialog" aria-label="Desafio de natação">
        <div className="activity-card">
          <span className="activity-icon">🏊</span>
          <strong>{state.fromNick} desafiou você</strong>
          <span>Duelo de natação com 10 segundos de duração.</span>
          <div className="activity-actions">
            <button type="button" className="activity-primary" onClick={onAccept}>Aceitar</button>
            <button type="button" onClick={onDecline}>Recusar</button>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "ended") {
    const mine = state.scores.find((score) => score.playerId === localId);
    const opponent = state.scores.find((score) => score.playerId !== localId);
    const title = state.tie ? "Empate!" : state.winnerId === localId ? "Você venceu!" : "Vitória do adversário";
    return (
      <div className="activity-overlay" role="dialog" aria-label="Resultado da natação">
        <div className="activity-card">
          <span className="activity-icon">🏁</span>
          <strong>{title}</strong>
          <span>{mine?.strokes ?? 0} impulsos seus · {opponent?.strokes ?? 0} de {opponent?.nick ?? "adversário"}</span>
          <button type="button" className="activity-primary" onClick={onDismiss}>Fechar</button>
        </div>
      </div>
    );
  }

  const now = getServerNow();
  const countdownMs = state.startAt - now;
  const raceRemaining = Math.max(0, state.endAt - now);
  const countdown = countdownMs > 0 ? Math.ceil(countdownMs / 1000) : 0;
  const showingGo = countdownMs <= 0 && now < state.startAt + 650;
  const scores = [...state.scores].sort((a, b) => b.progress - a.progress);

  return (
    <div className="swim-duel-hud" aria-live="polite">
      {countdownMs > 0 || showingGo ? (
        <div className="swim-duel-count">{countdownMs > 0 ? countdown : "JÁ"}</div>
      ) : (
        <>
          <div className="swim-duel-time">{(raceRemaining / 1000).toFixed(1)}s</div>
          {scores.map((score) => (
            <div className="swim-duel-row" key={score.playerId}>
              <span>{score.nick}{score.playerId === localId ? " (você)" : ""}</span>
              <div><i style={{ width: `${score.progress * 100}%` }} /></div>
              <strong>{score.strokes}</strong>
            </div>
          ))}
          <span className="swim-duel-hint">Solte e pressione Espaço a cada impulso</span>
          <button type="button" className="swim-duel-quit" onClick={onQuit}>Sair</button>
        </>
      )}
    </div>
  );
}
