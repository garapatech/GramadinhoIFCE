"use client";

import { useMediaPlayerPanel } from "@/features/media/useMediaPlayerPanel";

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
  const {
    panelRef,
    inputRef,
    draftUrl,
    media,
    error,
    setDraftUrl,
    handleSubmit,
    handleClear,
    handleBlurCapture,
    handleFocusCapture,
  } = useMediaPlayerPanel({ open, onClose, onFocusChange });

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      className="media-panel"
      onFocusCapture={handleFocusCapture}
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
