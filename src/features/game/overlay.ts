type PushBubble = (target: string, text: string, ttl?: number) => void;

type SpeechOverlayOptions = {
  statusEl: HTMLElement | null;
  speechEl: HTMLElement | null;
  speechBodyEl: HTMLElement | null;
  speechNameEl: HTMLElement | null;
  speechHintEl: HTMLElement | null;
  pushBubble: PushBubble;
};

export function createSpeechOverlay({
  statusEl,
  speechEl,
  speechBodyEl,
  speechNameEl,
  speechHintEl,
  pushBubble,
}: SpeechOverlayOptions) {
  function setStatus(text: string) {
    if (!statusEl) return;
    if (!text) {
      statusEl.textContent = "";
      statusEl.style.opacity = "0";
      statusEl.dataset.active = "0";
      return;
    }

    statusEl.textContent = text;
    statusEl.style.opacity = "1";
    statusEl.dataset.active = "1";
  }

  function showSpeech(text: string, speaker?: string, hint?: string) {
    if (!speechEl) return;
    if (speechBodyEl) speechBodyEl.textContent = text;
    if (speechNameEl) speechNameEl.textContent = speaker || "Aviso";
    if (speechHintEl) speechHintEl.textContent = hint || "[E]";
    speechEl.classList.add("visible");
  }

  function hideSpeech() {
    if (!speechEl) return;
    speechEl.classList.remove("visible");
  }

  function speak(text: string, speaker?: string) {
    if (!speechEl) {
      pushBubble("__local__", text, 3.2);
      return;
    }

    showSpeech(text, speaker, "");
    speechEl.dataset.locked = "1";
    speechEl.dataset.ttl = "2.6";
  }

  function clearSpeech() {
    if (!speechEl) return;
    if (speechEl.dataset.locked === "1") return;
    hideSpeech();
  }

  function releaseSpeechLock(dt: number) {
    if (!speechEl) return;
    if (speechEl.dataset.ttl) {
      const ttl = Math.max(0, Number(speechEl.dataset.ttl) - dt);
      speechEl.dataset.ttl = String(ttl);
      if (ttl <= 0) {
        speechEl.dataset.locked = "0";
        hideSpeech();
        delete speechEl.dataset.ttl;
      }
    }
  }

  return {
    clearSpeech,
    hideSpeech,
    releaseSpeechLock,
    setStatus,
    showSpeech,
    speak,
  };
}
