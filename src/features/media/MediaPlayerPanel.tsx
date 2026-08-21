"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { resolveMediaEmbed } from "@/features/media/mediaEmbeds";
import type { SocketInboundMessage } from "@/shared/schemas/multiplayer";

type GlobalMediaState = Extract<SocketInboundMessage, { type: "media-state" }>["state"];

type MediaPlayerPanelProps = {
  open: boolean;
  state: GlobalMediaState;
  getServerNow?: () => number;
  onSetUrl?: (url: string) => void;
  onControl?: (action: "pause" | "resume" | "stop" | "volume", volume?: number) => void;
  onClose?: () => void;
  onFocusChange?: (focused: boolean) => void;
};

function withPlaybackOptions(embedUrl: string, provider: "youtube" | "spotify", start: number) {
  if (provider !== "youtube") return embedUrl;
  const url = new URL(embedUrl);
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("playsinline", "1");
  url.searchParams.set("start", String(Math.max(0, Math.floor(start))));
  return url.toString();
}

export default function MediaPlayerPanel({
  open,
  state,
  getServerNow = Date.now,
  onSetUrl,
  onControl,
  onClose,
  onFocusChange,
}: MediaPlayerPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState("");

  const media = useMemo(() => {
    if (!state.url) return null;
    const resolved = resolveMediaEmbed(state.url);
    if (!resolved.ok) return null;
    const position = state.paused
      ? state.position
      : state.position + Math.max(0, getServerNow() - state.startedAt) / 1000;
    return {
      ...resolved,
      embedUrl: withPlaybackOptions(resolved.embedUrl, resolved.provider, position),
    };
    // Playback controls use postMessage, so only a new URL recreates the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.url]);

  useEffect(() => {
    if (state.url) setDraftUrl(state.url);
  }, [state.url]);

  useEffect(() => {
    if (!open) {
      onFocusChange?.(false);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, onFocusChange]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    syncYouTubePlayer();
  }, [state.paused, state.playing, state.provider, state.volume, state.updatedAt]);

  function syncYouTubePlayer() {
    if (state.provider !== "youtube" || !frameRef.current?.contentWindow) return;
    const target = "https://www.youtube.com";
    const command = state.paused || !state.playing ? "pauseVideo" : "playVideo";
    frameRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      target,
    );
    frameRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "setVolume", args: [Math.round(state.volume * 100)] }),
      target,
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolved = resolveMediaEmbed(draftUrl);
    if (!resolved.ok) {
      setError(resolved.reason);
      return;
    }
    setError("");
    onSetUrl?.(resolved.canonicalUrl);
  }

  function blurCapture() {
    window.setTimeout(() => {
      onFocusChange?.(!!panelRef.current?.contains(document.activeElement));
    }, 0);
  }

  return (
    <aside
      ref={panelRef}
      className={`media-panel${open ? "" : " media-panel-hidden"}`}
      aria-hidden={!open}
      onFocusCapture={() => onFocusChange?.(true)}
      onBlurCapture={blurCapture}
    >
      <div className="media-panel-header">
        <div>
          <span className="media-panel-kicker">Som global sincronizado</span>
          <strong className="media-panel-title">Rádio do campus</strong>
        </div>
        <button type="button" className="media-panel-close" onClick={onClose}>Fechar</button>
      </div>

      <form className="media-form" onSubmit={submit}>
        <label className="media-label" htmlFor="media-url">URL do YouTube ou Spotify</label>
        <input
          id="media-url"
          ref={inputRef}
          className="media-input"
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          placeholder="https://youtu.be/... ou https://open.spotify.com/track/..."
          autoComplete="off"
          spellCheck={false}
          tabIndex={open ? 0 : -1}
        />
        <div className="media-actions">
          <button type="submit" className="media-btn media-btn-primary">Tocar globalmente</button>
          {state.url ? (
            <>
              <button type="button" className="media-btn" onClick={() => onControl?.(state.paused ? "resume" : "pause")}>
                {state.paused ? "Continuar" : "Pausar"}
              </button>
              <button type="button" className="media-btn" onClick={() => onControl?.("stop")}>Parar</button>
            </>
          ) : null}
        </div>
        {state.url ? (
          <label className="media-volume">
            Volume {Math.round(state.volume * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.volume}
              onChange={(event) => onControl?.("volume", Number(event.target.value))}
            />
          </label>
        ) : null}
      </form>

      <p className={`media-feedback${error ? " error" : ""}`}>
        {error || (state.startedByNick ? `Iniciada por ${state.startedByNick}. A reprodução acompanha você pelo mapa.` : "A música continuará tocando ao fechar esta janela.")}
      </p>

      {media ? (
        <div className="media-player-shell">
          <div className="media-player-meta">
            <span className={`media-provider media-provider-${media.provider}`}>{media.providerLabel}</span>
            <a className="media-source-link" href={media.canonicalUrl} target="_blank" rel="noreferrer">Abrir original</a>
          </div>
          <div className={`media-frame-wrap media-frame-wrap-${media.provider}`}>
            <iframe
              ref={frameRef}
              key={state.url}
              className="media-frame"
              src={media.embedUrl}
              title={`Player ${media.providerLabel}`}
              onLoad={syncYouTubePlayer}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="media-empty"><strong>Nada tocando agora.</strong><span>Cole um link na caixa de som.</span></div>
      )}
    </aside>
  );
}
