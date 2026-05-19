"use client";

const STATUS_LABEL = {
  idle: "voz desligada",
  listening: "ouvindo voz",
  requesting: "solicitando microfone",
  connecting: "conectando voz",
  calling: "chamando",
  answering: "conectando voz",
  connected: "voz ativa",
  disconnected: "reconectando voz",
  blocked: "audio bloqueado",
  failed: "falha na voz",
  error: "voz indisponivel",
};

export default function VoiceChat({
  voice,
  connection,
  onStart,
  onStop,
  onToggleMute,
  onUnlockAudio,
}) {
  const state = voice || {};
  const isBlocked = state.status === "blocked";
  const disabled =
    (!isBlocked && state.status === "requesting") ||
    connection !== "connected" ||
    !state.ready ||
    state.supported === false;
  const canSpeak = state.enabled && state.status !== "requesting";
  const hasPeers = (state.peerCount || 0) > 0;
  const label =
    state.error ||
    STATUS_LABEL[state.status] ||
    (state.enabled ? "voz ativa" : "voz desligada");

  return (
    <div className={`voice${state.enabled ? " on" : ""}${state.receivingCount > 0 ? " listening" : ""}${state.error ? " error" : ""}`}>
      <div className="voice-info">
        <span className="voice-dot" aria-hidden="true"></span>
        <span className="voice-label">{label}</span>
        {state.enabled && (
          <span className="voice-count">
            {hasPeers ? `${state.peerCount} conectado(s)` : "sem conexoes"}
          </span>
        )}
        {!state.enabled && state.receivingCount > 0 && (
          <span className="voice-count">
            {`${state.receivingCount} falando`}
          </span>
        )}
      </div>

      <div className="voice-actions">
        {!state.enabled ? (
          <button
            type="button"
            className="voice-btn primary"
            onClick={() => (isBlocked ? onUnlockAudio?.() : onStart?.())}
            disabled={disabled}
            title={isBlocked ? "Liberar audio remoto" : "Ativar chat de voz"}
          >
            {isBlocked ? "Liberar" : "Voz"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="voice-btn"
              onClick={() => onToggleMute?.()}
              disabled={!canSpeak}
              title={state.muted ? "Reativar microfone" : "Mutar microfone"}
            >
              {state.muted ? "Desmutar" : "Mutar"}
            </button>
            <button
              type="button"
              className="voice-btn"
              onClick={() => onStop?.()}
              title="Sair do chat de voz"
            >
              Sair
            </button>
          </>
        )}
      </div>
    </div>
  );
}
