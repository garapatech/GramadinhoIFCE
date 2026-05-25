import { useEffect, type RefObject } from "react";

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

type UseChatHotkeysOptions = {
  inputRef: RefObject<HTMLInputElement | null>;
  onToggleVisible?: () => void;
};

export function useChatHotkeys({ inputRef, onToggleVisible }: UseChatHotkeysOptions) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isFocused = document.activeElement === inputRef.current;

      if (event.code === "KeyT" && !isFocused) {
        if (isTextEntryTarget(event.target)) return;
        event.preventDefault();
        onToggleVisible?.();
        return;
      }

      if (event.code === "Enter" || event.key === "Enter") {
        if (!isFocused) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputRef, onToggleVisible]);
}
