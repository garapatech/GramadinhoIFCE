"use client";

import { useEffect, useRef, useState } from "react";

const STATUS_LABEL = {
  connecting: "conectando…",
  connected: "online",
  disconnected: "desconectado",
  error: "sem conexão",
};

export default function Chat({
  messages,
  onSend,
  onFocusChange,
  connection,
  myNick,
  visible,
  onToggleVisible,
}) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, visible]);

  useEffect(() => {
    function onKey(e) {
      const isInChat = document.activeElement === inputRef.current;
      if (e.code === "KeyT" && !isInChat) {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        onToggleVisible?.();
        return;
      }
      if (e.code === "Enter" || e.key === "Enter") {
        if (!isInChat) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggleVisible]);

  function submit(e) {
    e.preventDefault();
    const ok = onSend(text);
    if (ok) setText("");
    inputRef.current?.blur();
  }

  return (
    <div className={`chat${visible ? "" : " chat-min"}`}>
      <div className="chat-header">
        <span className="chat-status">{STATUS_LABEL[connection] || connection}</span>
        <button
          type="button"
          className="chat-toggle"
          onClick={() => onToggleVisible?.()}
          title={visible ? "Ocultar mensagens (T)" : "Mostrar mensagens (T)"}
        >
          {visible ? "Ocultar ✕" : "Mostrar 💬"}
        </button>
      </div>

      {visible && (
        <div
          ref={listRef}
          className={`chat-messages ${messages.length === 0 ? "empty" : ""}`}
        >
          {messages.map((m, i) => {
            const isSystem = m.id === "__system__";
            const isYou = !isSystem && m.nick === myNick;
            return (
              <div key={i} className={`chat-msg${isSystem ? " system" : ""}${isYou ? " you" : ""}`}>
                <span className="nick">{isSystem ? "•" : m.nick}:</span>
                <span>{m.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <form className="chat-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="chat-input"
          placeholder={visible ? "Aperte Enter para conversar…" : "Digite e Enter (chat oculto)"}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 240))}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          maxLength={240}
        />
        <button type="submit" className="chat-send" disabled={!text.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
