"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarCustomizer from "@/features/avatar/AvatarCustomizer";
import { getDefaultAvatar, readStoredAvatar, writeStoredAvatar } from "@/features/avatar/avatarConfig";

const STORAGE_KEY = "gramadinho.nick";

export default function MainMenu() {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState(getDefaultAvatar);
  const [avatarReady, setAvatarReady] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setNick(saved);
    } catch {}
    setAvatar(readStoredAvatar());
    setAvatarReady(true);
    router.prefetch("/play");
  }, [router]);

  useEffect(() => {
    if (!avatarReady) return;
    writeStoredAvatar(avatar);
  }, [avatar, avatarReady]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = nick.trim();
    if (trimmed.length < 2) {
      setError("Seu nick precisa de pelo menos 2 letras.");
      return;
    }
    if (trimmed.length > 16) {
      setError("Nick muito grande (máx. 16 caracteres).");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {}
    writeStoredAvatar(avatar);
    router.push(`/play?nick=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="menu">
      <div className="menu-card">
        <h1 className="logo">
          Gramadinho <span>IFCE</span>
        </h1>
        <p className="slogan">Se divirtam no gramado do IFCE!</p>

        <form className="menu-actions" onSubmit={handleSubmit}>
          <input
            className="nick-input"
            type="text"
            placeholder="Digite seu nick"
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              if (error) setError("");
            }}
            maxLength={16}
            autoFocus
          />
          <p className="error-msg">{error || " "}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCustomizerOpen((open) => !open)}
          >
            {customizerOpen ? "Fechar visual" : "Personalizar personagem"}
          </button>
          {customizerOpen && (
            <AvatarCustomizer avatar={avatar} onChange={setAvatar} />
          )}
          <button type="submit" className="btn-play">
            Jogar
          </button>
        </form>
      </div>

      <p className="menu-credit">
        Feito com carinho • WASD para mover • E para interagir • Enter para o chat • G/Shift+G/1/2/3/4/5 para emotes • Voz para falar
      </p>
    </main>
  );
}
