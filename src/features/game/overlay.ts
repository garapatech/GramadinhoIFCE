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
  let lastStatus: string | null = null;
  let lastSpeech = "";
  let speechVisible = false;
  let speechLockTtl = 0;

  function setStatus(text: string) {
    if (!statusEl) return;
    if (text === lastStatus) return;
    lastStatus = text;
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
    const resolvedSpeaker = speaker || "Aviso";
    const resolvedHint = hint || "[E]";
    const signature = `${resolvedSpeaker}\u0000${text}\u0000${resolvedHint}`;
    if (signature !== lastSpeech) {
      lastSpeech = signature;
      if (speechBodyEl) speechBodyEl.textContent = text;
      if (speechNameEl) speechNameEl.textContent = resolvedSpeaker;
      if (speechHintEl) speechHintEl.textContent = resolvedHint;
    }
    if (!speechVisible) {
      speechVisible = true;
      speechEl.classList.add("visible");
    }
  }

  function hideSpeech() {
    if (!speechEl) return;
    if (!speechVisible) return;
    speechVisible = false;
    speechEl.classList.remove("visible");
  }

  function speak(text: string, speaker?: string) {
    if (!speechEl) {
      pushBubble("__local__", text, 3.2);
      return;
    }

    showSpeech(text, speaker, "");
    speechEl.dataset.locked = "1";
    speechLockTtl = 2.6;
  }

  function clearSpeech() {
    if (!speechEl) return;
    if (speechEl.dataset.locked === "1") return;
    hideSpeech();
  }

  function releaseSpeechLock(dt: number) {
    if (!speechEl) return;
    if (speechLockTtl > 0) {
      speechLockTtl = Math.max(0, speechLockTtl - dt);
      if (speechLockTtl <= 0) {
        speechEl.dataset.locked = "0";
        hideSpeech();
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
