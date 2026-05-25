export type MediaProvider = "youtube" | "spotify";

export type MediaEmbedSuccess = {
  ok: true;
  provider: MediaProvider;
  providerLabel: string;
  embedUrl: string;
  canonicalUrl: string;
};

export type MediaEmbedFailure = {
  ok: false;
  reason: string;
};

export type MediaEmbedResult = MediaEmbedSuccess | MediaEmbedFailure;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const SPOTIFY_HOSTS = new Set(["open.spotify.com", "play.spotify.com"]);

const SPOTIFY_TYPES = new Set(["track", "album", "playlist", "episode", "show"]);

function getUrlFromInput(input: unknown): URL | string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (raw.startsWith("spotify:")) {
    return raw;
  }

  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }
}

function normalizeId(value: unknown): string {
  return String(value || "")
    .trim()
    .split("?")[0]
    .split("&")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
}

function resolveYouTubeEmbed(url: URL): MediaEmbedSuccess | null {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === "youtu.be") {
    const videoId = normalizeId(url.pathname.slice(1));
    if (!videoId) return null;
    return {
      ok: true,
      provider: "youtube",
      providerLabel: "YouTube",
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`,
      canonicalUrl: `https://youtu.be/${videoId}`,
    };
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const videoId =
    normalizeId(url.searchParams.get("v")) ||
    (pathParts[0] === "shorts" ? normalizeId(pathParts[1]) : "") ||
    (pathParts[0] === "embed" ? normalizeId(pathParts[1]) : "") ||
    (pathParts[0] === "live" ? normalizeId(pathParts[1]) : "");

  if (videoId) {
    return {
      ok: true,
      provider: "youtube",
      providerLabel: "YouTube",
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`,
      canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    };
  }

  const playlistId = normalizeId(url.searchParams.get("list"));
  if (!playlistId) return null;

  return {
    ok: true,
    provider: "youtube",
    providerLabel: "YouTube",
    embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(
      playlistId
    )}&autoplay=1&rel=0`,
    canonicalUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
  };
}

function resolveSpotifyTypeAndId(rawValue: unknown): { type: string; id: string } | null {
  if (typeof rawValue === "string" && rawValue.startsWith("spotify:")) {
    const parts = rawValue.split(":").filter(Boolean);
    const type = parts[1];
    const id = normalizeId(parts[2]);
    if (SPOTIFY_TYPES.has(type) && id) return { type, id };
    return null;
  }

  const url = rawValue as URL;
  const parts = url.pathname.split("/").filter(Boolean);
  const cleanParts = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
  const typeIndex = cleanParts.findIndex((part) => SPOTIFY_TYPES.has(part));
  if (typeIndex === -1) return null;

  const type = cleanParts[typeIndex];
  const id = normalizeId(cleanParts[typeIndex + 1]);
  if (!id) return null;
  return { type, id };
}

function resolveSpotifyEmbed(value: URL | string): MediaEmbedSuccess | null {
  if (typeof value === "string") {
    const parsed = resolveSpotifyTypeAndId(value);
    if (!parsed) return null;
    return {
      ok: true,
      provider: "spotify",
      providerLabel: "Spotify",
      embedUrl: `https://open.spotify.com/embed/${parsed.type}/${encodeURIComponent(
        parsed.id
      )}?utm_source=generator`,
      canonicalUrl: `https://open.spotify.com/${parsed.type}/${encodeURIComponent(parsed.id)}`,
    };
  }

  const host = value.hostname.toLowerCase();
  if (!SPOTIFY_HOSTS.has(host)) return null;

  const parsed = resolveSpotifyTypeAndId(value);
  if (!parsed) return null;

  return {
    ok: true,
    provider: "spotify",
    providerLabel: "Spotify",
    embedUrl: `https://open.spotify.com/embed/${parsed.type}/${encodeURIComponent(
      parsed.id
    )}?utm_source=generator`,
    canonicalUrl: `https://open.spotify.com/${parsed.type}/${encodeURIComponent(parsed.id)}`,
  };
}

export function resolveMediaEmbed(input: unknown): MediaEmbedResult {
  const parsed = getUrlFromInput(input);
  if (!parsed) {
    return {
      ok: false,
      reason: "Cole uma URL valida do YouTube ou do Spotify.",
    };
  }

  const result =
    typeof parsed === "string"
      ? resolveSpotifyEmbed(parsed)
      : resolveYouTubeEmbed(parsed) || resolveSpotifyEmbed(parsed);

  if (!result) {
    return {
      ok: false,
      reason: "Use um link publico do YouTube ou do Spotify.",
    };
  }

  return result;
}
