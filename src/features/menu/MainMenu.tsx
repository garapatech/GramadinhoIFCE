"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import AvatarCustomizer from "@/features/avatar/AvatarCustomizer";
import { useStoredAvatar } from "@/features/avatar/useStoredAvatar";
import {
  readStoredNick,
  writeStoredNick,
} from "@/features/menu/nickStorage";
import {
  NICK_MAX_LENGTH,
  nickSchema,
} from "@/shared/schemas/nick";

export default function MainMenu() {
  const router = useRouter();
  const [nick, setNick] = useState(readStoredNick);
  const [avatar, setAvatar] = useStoredAvatar();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    router.prefetch("/play");
  }, [router]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = nick.trim();

    const parsed = nickSchema.safeParse(trimmed);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "");
      return;
    }

    writeStoredNick(trimmed);
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
