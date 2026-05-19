"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "gramadinho.nick";

export default function MainMenu() {
  const router = useRouter();
  const [nick, setNick] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setNick(saved);
    } catch {}
    router.prefetch("/play");
  }, [router]);

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
          <button type="submit" className="btn-play">
            Jogar
          </button>
        </form>
      </div>

      <p className="menu-credit">
        Feito com carinho • Use WASD para mover • E para interagir • Enter para o chat • Voz para falar
      </p>
    </main>
  );
}
