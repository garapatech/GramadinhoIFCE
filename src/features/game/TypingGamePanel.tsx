"use client";

import { useEffect, useRef, useState } from "react";
import type { GameOnlinePlayer } from "@/features/game/gameViewState";
import type { SocketInboundMessage } from "@/shared/schemas/multiplayer";

type TypingStart = Extract<SocketInboundMessage, { type: "typing-start" }>;
type TypingResult = Extract<SocketInboundMessage, { type: "typing-progress" }>["results"][number];
type TypingRoom = Extract<SocketInboundMessage, { type: "typing-room-state" }>;
type TypingLobbyRoom = Extract<SocketInboundMessage, { type: "typing-lobby" }>["rooms"][number];

export type TypingIncoming = Extract<SocketInboundMessage, { type: "typing-challenge" }>;
export type TypingMatchUi = {
  start: TypingStart;
  results: TypingResult[];
  ended: Extract<SocketInboundMessage, { type: "typing-end" }> | null;
};

type Props = {
  open: boolean;
  computerId: string;
  localId: string | null;
  players: GameOnlinePlayer[];
  incoming: TypingIncoming | null;
  room: TypingRoom | null;
  lobby: TypingLobbyRoom[];
  match: TypingMatchUi | null;
  getServerNow: () => number;
  onClose: () => void;
  onSolo: () => void;
  onChallenge: (playerId: string) => void;
  onRespond: (accepted: boolean) => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onStartRoom: () => void;
  onInput: (value: string) => void;
  onQuitMatch: () => void;
};

export default function TypingGamePanel(props: Props) {
  const { open, incoming, match, room } = props;
  const [typed, setTyped] = useState("");
  const [, redraw] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setTyped("");
  }, [match?.start.matchId]);

  useEffect(() => {
    if (!match || match.ended) return;
    const timer = window.setInterval(() => redraw((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [match, match?.ended]);

  useEffect(() => {
    if (!match || match.ended) return;
    const delay = Math.max(0, match.start.startAt - props.getServerNow());
    const timer = window.setTimeout(() => inputRef.current?.focus(), delay + 20);
    return () => window.clearTimeout(timer);
  }, [match?.start.matchId, match?.start.startAt, match?.ended]);

  if (!open && !incoming) return null;

  if (incoming) {
    return (
      <div className="activity-overlay" role="dialog" aria-label="Desafio de digitação">
        <div className="activity-card">
          <span className="activity-icon">⌨️</span>
          <strong>{incoming.fromNick} quer disputar digitação</strong>
          <span>Os dois receberão exatamente a mesma frase.</span>
          <div className="activity-actions">
            <button type="button" className="activity-primary" onClick={() => props.onRespond(true)}>Aceitar</button>
            <button type="button" onClick={() => props.onRespond(false)}>Recusar</button>
          </div>
        </div>
      </div>
    );
  }

  if (match) {
    const now = props.getServerNow();
    const waiting = now < match.start.startAt;
    const showingGo = !waiting && now < match.start.startAt + 650;
    const mine = match.results.find((result) => result.playerId === props.localId);
    if (match.ended) {
      const won = match.ended.winnerId === props.localId;
      return (
        <div className="typing-panel" role="dialog" aria-label="Resultado de digitação">
          <header><span>Resultado</span><button type="button" onClick={props.onQuitMatch}>Fechar</button></header>
          <div className="typing-result-title">{match.ended.winnerId === null ? "Partida encerrada" : won ? "Você venceu!" : "Prova concluída"}</div>
          <div className="typing-ranking">
            {match.ended.results.map((result) => (
              <div key={result.playerId}>
                <strong>{result.rank ? `${result.rank}º` : "—"} {result.nick}</strong>
                <span>{result.wpm.toFixed(1)} WPM · {result.accuracy.toFixed(1)}% · {result.errors} erros</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="typing-panel" role="dialog" aria-label="Minigame de digitação">
        <header><span>{match.start.mode === "solo" ? "Treino solo" : match.start.mode === "duel" ? "Duelo" : "Desafio multiplayer"}</span><button type="button" onClick={props.onQuitMatch}>Sair</button></header>
        {waiting || showingGo ? (
          <div className="typing-countdown">
            {waiting ? Math.max(1, Math.ceil((match.start.startAt - now) / 1000)) : "JÁ"}
          </div>
        ) : null}
        <p className="typing-copy">{match.start.text}</p>
        <textarea
          ref={inputRef}
          value={typed}
          disabled={waiting || mine?.finished === true}
          onPaste={(event) => event.preventDefault()}
          onChange={(event) => {
            const next = event.target.value.slice(0, match.start.text.length + 8);
            setTyped(next);
            props.onInput(next);
          }}
          spellCheck={false}
          autoComplete="off"
          placeholder={waiting ? "Aguarde a largada..." : "Digite a frase exatamente como aparece"}
        />
        <div className="typing-live-stats">
          <span>{Math.round((mine?.progress ?? 0) * 100)}%</span>
          <span>{mine?.errors ?? 0} erros</span>
          <span>{Math.max(0, Math.ceil((match.start.deadlineAt - now) / 1000))}s</span>
        </div>
        {match.results.length > 1 ? (
          <div className="typing-progress-list">
            {match.results.map((result) => <span key={result.playerId}><i style={{ width: `${result.progress * 100}%` }} />{result.nick}</span>)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="typing-panel" role="dialog" aria-label="Computador do laboratório">
      <header><span>Terminal {props.computerId.replace("pc-", "")}</span><button type="button" onClick={props.onClose}>Fechar</button></header>
      {room ? (
        <section className="typing-room-card">
          <strong>Sala de {room.hostNick}</strong>
          <span>{room.participants.map((participant) => participant.nick).join(" · ")}</span>
          <div className="activity-actions">
            {room.hostId === props.localId ? <button type="button" className="activity-primary" onClick={props.onStartRoom}>Iniciar</button> : null}
            <button type="button" onClick={props.onLeaveRoom}>Sair da sala</button>
          </div>
        </section>
      ) : (
        <>
          <div className="typing-menu-actions">
            <button type="button" className="activity-primary" onClick={props.onSolo}>Jogar sozinho</button>
            <button type="button" onClick={props.onCreateRoom}>Criar sala multiplayer</button>
          </div>
          <section>
            <strong>Desafiar jogador</strong>
            <div className="typing-choice-list">
              {props.players.filter((player) => !player.isYou).map((player) => (
                <button type="button" key={player.id} onClick={() => props.onChallenge(player.id)}>{player.nick}</button>
              ))}
              {props.players.every((player) => player.isYou) ? <span>Nenhum outro jogador conectado.</span> : null}
            </div>
          </section>
          <section>
            <strong>Salas abertas</strong>
            <div className="typing-choice-list">
              {props.lobby.map((entry) => (
                <button type="button" key={entry.roomId} onClick={() => props.onJoinRoom(entry.roomId)}>{entry.hostNick} · {entry.participantCount}/8</button>
              ))}
              {props.lobby.length === 0 ? <span>Nenhuma sala aguardando.</span> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
