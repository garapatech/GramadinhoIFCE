"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import AvatarCustomizer from "@/features/avatar/AvatarCustomizer";
import {
  getDefaultAvatar,
  readStoredAvatar,
  writeStoredAvatar,
  type Avatar,
} from "@/features/avatar/avatarConfig";

const STORAGE_KEY = "gramadinho.nick";
const NICK_MIN_LENGTH = 2;
const NICK_MAX_LENGTH = 16;

export default function MainMenu() {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [avatar, setAvatar] = useState<Avatar>(getDefaultAvatar);
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

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = nick.trim();
    if (trimmed.length < NICK_MIN_LENGTH) {
      setError("Seu nick precisa de pelo menos 2 letras.");
      return;
    }
    if (trimmed.length > NICK_MAX_LENGTH) {
      setError("Nick muito grande (máx. 16 caracteres).");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {}
    writeStoredAvatar(avatar);
    router.push(`/play?nick=${encodeURIComponent(trimmed)}`);
  }

  function handleNickChange(e: ChangeEvent<HTMLInputElement>) {
    setNick(e.target.value);
    if (error) setError("");
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
            onChange={handleNickChange}
            maxLength={NICK_MAX_LENGTH}
            autoFocus
          />
          <p className="error-msg">{error || " "}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCustomizerOpen(true)}
          >
            Personalizar personagem
          </button>
          <button type="submit" className="btn-play">
            Jogar
          </button>
        </form>
      </div>

      <p className="menu-credit">
        Feito com carinho • WASD para mover • E para interagir • Enter para o chat • G/Shift+G/1/2/3/4/5 para emotes • Voz para falar
      </p>

      {customizerOpen && (
        <AvatarCustomizer
          avatar={avatar}
          onChange={setAvatar}
          onClose={() => setCustomizerOpen(false)}
        />
      )}
    </main>
  );
}
