"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveMediaEmbed,
  type MediaEmbedSuccess,
} from "@/features/media/mediaEmbeds";

const STORAGE_KEY = "gramadinho.media.url";

type MediaPlayerPanelProps = {
  open: boolean;
  onClose?: () => void;
  onFocusChange?: (focused: boolean) => void;
};

export default function MediaPlayerPanel({
  open,
  onClose,
  onFocusChange,
}: MediaPlayerPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [media, setMedia] = useState<MediaEmbedSuccess | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedUrl = window.localStorage.getItem(STORAGE_KEY) || "";
    if (!savedUrl) return;

    setDraftUrl(savedUrl);
    const resolved = resolveMediaEmbed(savedUrl);
    if (resolved.ok) {
      setMedia(resolved);
      setError("");
    } else {
      setError("reason" in resolved ? resolved.reason : "");
    }
  }, []);

  useEffect(() => {
    if (!open) {
      onFocusChange?.(false);
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);

    return () => window.clearTimeout(timer);
  }, [open, onFocusChange]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolved = resolveMediaEmbed(draftUrl);
    if (!resolved.ok) {
      setError("reason" in resolved ? resolved.reason : "");
      return;
    }

    setMedia(resolved);
    setError("");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, draftUrl.trim());
    }
  }

  function handleClear() {
    setDraftUrl("");
    setMedia(null);
    setError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    inputRef.current?.focus();
  }

  function handleBlurCapture() {
    window.setTimeout(() => {
      const hasFocusInside = panelRef.current?.contains(document.activeElement);
      onFocusChange?.(!!hasFocusInside);
    }, 0);
  }

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      className="media-panel"
      onFocusCapture={() => onFocusChange?.(true)}
      onBlurCapture={handleBlurCapture}
    >
      <div className="media-panel-header">
        <div>
          <span className="media-panel-kicker">Objeto interagivel</span>
          <strong className="media-panel-title">Radio do campus</strong>
        </div>
        <button
          type="button"
          className="media-panel-close"
          onClick={() => onClose?.()}
          title="Fechar player"
        >
          Fechar
        </button>
      </div>

      <form className="media-form" onSubmit={handleSubmit}>
        <label className="media-label" htmlFor="media-url">
          URL do YouTube ou Spotify
        </label>
        <input
          id="media-url"
          ref={inputRef}
          className="media-input"
          value={draftUrl}
          onChange={(event) => setDraftUrl(event.target.value)}
          placeholder="https://youtu.be/... ou https://open.spotify.com/track/..."
          autoComplete="off"
          spellCheck="false"
        />
        <div className="media-actions">
          <button type="submit" className="media-btn media-btn-primary">
            Tocar
          </button>
          <button type="button" className="media-btn" onClick={handleClear}>
            Limpar
          </button>
        </div>
      </form>

      <p className={`media-feedback${error ? " error" : ""}`}>
        {error ||
          "Links publicos de video, musica, playlist e album funcionam melhor. Alguns embeds podem pedir clique no proprio player."}
      </p>

      {media ? (
        <div className="media-player-shell">
          <div className="media-player-meta">
            <span className={`media-provider media-provider-${media.provider}`}>
              {media.providerLabel}
            </span>
            <a
              className="media-source-link"
              href={media.canonicalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir original
            </a>
          </div>

          <div className={`media-frame-wrap media-frame-wrap-${media.provider}`}>
            <iframe
              key={media.embedUrl}
              className="media-frame"
              src={media.embedUrl}
              title={`Player ${media.providerLabel}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="media-empty">
          <strong>Nada tocando agora.</strong>
          <span>Interaja com a radio, cole a URL e carregue o player.</span>
        </div>
      )}
    </aside>
  );
}
