"use client";

import type { GameOnlinePlayer, GamePvpState } from "@/features/game/gameViewState";

const ACTIVITY_LABEL: Record<GameOnlinePlayer["activity"], string> = {
  idle: "parado",
  walking: "andando",
  running: "correndo",
  crouching: "agachado",
  sitting: "sentado",
  riding: "pedalando",
  emoting: "emote",
};

type OnlinePlayersPanelProps = {
  players: GameOnlinePlayer[];
  pvpState: GamePvpState | null;
  onChallenge: (playerId: string) => void;
};

export default function OnlinePlayersPanel({
  players,
  pvpState,
  onChallenge,
}: OnlinePlayersPanelProps) {
  return (
    <div className="players-panel" role="dialog" aria-label="Jogadores online">
      <div className="players-panel-head">
        <span>Jogadores online</span>
        <strong>{players.length}</strong>
      </div>
      <div className="players-list">
        {players.map((player) => (
          <div key={player.id} className={`players-row${player.isYou ? " you" : ""}`}>
            <span className="players-dot" aria-hidden="true" />
            <span className="players-name">
              {player.nick}
              {player.isYou ? " (você)" : ""}
            </span>
            <span className="players-activity">
              {ACTIVITY_LABEL[player.activity] || player.activity || "parado"}
            </span>
            <span className={`players-voice${player.voiceEnabled ? " on" : ""}`}>
              {player.voiceEnabled ? (player.voiceMuted ? "mutado" : "voz") : "sem voz"}
            </span>
            {!player.isYou && !pvpState && (
              <button
                type="button"
                className="players-pvp-btn"
                onClick={() => onChallenge(player.id)}
                title="Desafiar para queimado"
              >
                🏐
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
