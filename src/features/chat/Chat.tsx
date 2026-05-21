"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/shared/schemas/multiplayer";

const STATUS_LABEL = {
  connecting: "conectando…",
  connected: "online",
  disconnected: "desconectado",
  error: "sem conexão",
} as const;

type ChatEntry = ChatMessage & {
  key?: string;
  likeCount?: number;
};

type ChatProps = {
  messages: ChatEntry[];
  onSend: (text: string) => boolean;
  onReact?: (message: ChatEntry) => void;
  onFocusChange?: (focused: boolean) => void;
  connection: string;
  myNick: string;
  visible: boolean;
  onToggleVisible?: () => void;
};

export default function Chat({
  messages,
  onSend,
  onReact,
  onFocusChange,
  connection,
  myNick,
  visible,
  onToggleVisible,
}: ChatProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, visible]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const isInChat = document.activeElement === inputRef.current;
      if (e.code === "KeyT" && !isInChat) {
        if (e.target && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;
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

    window.addEventListener("keydown", onKey as EventListener);
    return () => window.removeEventListener("keydown", onKey as EventListener);
  }, [onToggleVisible]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = onSend(text);
    if (ok) setText("");
    inputRef.current?.blur();
  }

  const connectionLabel =
    STATUS_LABEL[connection as keyof typeof STATUS_LABEL] ?? connection;

  return (
    <div className={`chat${visible ? "" : " chat-min"}`}>
      <div className="chat-header">
        <span className="chat-status">{connectionLabel}</span>
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
          {messages.map((message, index) => {
            const isSystem = message.id === "__system__";
            const isYou = !isSystem && message.nick === myNick;
            return (
              <div
                key={message.key || index}
                className={`chat-msg${isSystem ? " system" : ""}${isYou ? " you" : ""}`}
              >
                <div className="chat-msg-line">
                  <span className="nick">{isSystem ? "•" : message.nick}:</span>
                  <span>{message.text}</span>
                </div>
                {!isSystem && (
                  <div className="chat-msg-actions">
                    <button
                      type="button"
                      className="chat-react"
                      onClick={() => onReact?.(message)}
                      title="Curtir esta mensagem"
                    >
                      👍 Curtir
                    </button>
                    <span className={`chat-like-count${message.likeCount ? " active" : ""}`}>
                      {message.likeCount ? `+${message.likeCount}` : "0"}
                    </span>
                  </div>
                )}
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
          onChange={(event) => setText(event.target.value.slice(0, 240))}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.blur();
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
