"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { resolveMediaEmbed, type MediaEmbedSuccess } from "@/features/media/mediaEmbeds";
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "@/shared/storage/localStorage";

const STORAGE_KEY = "gramadinho.media.url";

type MediaPlayerPanelOptions = {
  open: boolean;
  onClose?: () => void;
  onFocusChange?: (focused: boolean) => void;
};

export function useMediaPlayerPanel({
  open,
  onClose,
  onFocusChange,
}: MediaPlayerPanelOptions) {
  const panelRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [media, setMedia] = useState<MediaEmbedSuccess | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedUrl = readLocalStorageItem(STORAGE_KEY) || "";
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolved = resolveMediaEmbed(draftUrl);
    if (!resolved.ok) {
      setError("reason" in resolved ? resolved.reason : "");
      return;
    }

    setMedia(resolved);
    setError("");
    writeLocalStorageItem(STORAGE_KEY, draftUrl.trim());
  }

  function handleClear() {
    setDraftUrl("");
    setMedia(null);
    setError("");
    removeLocalStorageItem(STORAGE_KEY);
    inputRef.current?.focus();
  }

  function handleBlurCapture() {
    window.setTimeout(() => {
      const hasFocusInside = panelRef.current?.contains(document.activeElement);
      onFocusChange?.(!!hasFocusInside);
    }, 0);
  }

  function handleFocusCapture() {
    onFocusChange?.(true);
  }

  return {
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
  };
}
