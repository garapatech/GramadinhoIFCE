"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type CSSProperties, type ComponentType } from "react";
import type { Avatar } from "@/features/avatar/avatarConfig";
import {
  ShirtIcon,
  PantsIcon,
  ShoesIcon,
  SkinIcon,
  HairIcon,
  BackpackIcon,
  GlassesIcon,
  PaletteIcon,
  SparkleIcon,
  CloseIcon,
} from "@/features/avatar/icons";

const Avatar3DPreview = dynamic(
  () => import("@/features/avatar/Avatar3DPreview"),
  { ssr: false, loading: () => <div className="avatar-3d-stage" /> }
);

type AvatarFieldKey = "shirt" | "pants" | "shoes" | "skin" | "hair" | "backpack" | "accent";

type AvatarField = {
  key: AvatarFieldKey;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  palette: string[];
};

type AvatarCustomizerProps = {
  avatar: Avatar;
  onChange?: (avatar: Avatar) => void;
  onClose?: () => void;
};

const COLOR_FIELDS: AvatarField[] = [
  {
    key: "shirt",
    label: "Camisa",
    Icon: ShirtIcon,
    palette: ["#2f855a", "#d94a4a", "#3a6dc9", "#f6b94b", "#9b59b6", "#e87bb1", "#1f3550", "#f5f5f5"],
  },
  {
    key: "pants",
    label: "Calça",
    Icon: PantsIcon,
    palette: ["#24364d", "#2b2b2b", "#5a4a32", "#3b6b3b", "#7a3a3a", "#4b4b6e", "#a08054", "#6e6e6e"],
  },
  {
    key: "shoes",
    label: "Tênis",
    Icon: ShoesIcon,
    palette: ["#1a1a1a", "#ffffff", "#d94a4a", "#3a6dc9", "#2f855a", "#f6b94b", "#5a3220", "#7a3aa0"],
  },
  {
    key: "skin",
    label: "Pele",
    Icon: SkinIcon,
    palette: ["#f4d4ba", "#f0c3a5", "#d9a079", "#b97a52", "#8a5a3b", "#5e3a24", "#f6cdb0", "#caa080"],
  },
  {
    key: "hair",
    label: "Cabelo",
    Icon: HairIcon,
    palette: ["#3a2516", "#1b1b1b", "#6b4226", "#a86a3c", "#d8b46a", "#ddd0a8", "#8a3a3a", "#5a4f7a"],
  },
  {
    key: "backpack",
    label: "Mochila",
    Icon: BackpackIcon,
    palette: ["#b85a31", "#2f855a", "#3a6dc9", "#7a3aa0", "#2b2b2b", "#d94a4a", "#f6b94b", "#1f3550"],
  },
  {
    key: "accent",
    label: "Detalhes",
    Icon: SparkleIcon,
    palette: ["#f6b94b", "#67d9ec", "#e85858", "#8f6ed5", "#f7f7f2", "#252b31", "#39b87f", "#e889bd"],
  },
];

const STYLE_OPTIONS = [
  { key: "hairStyle", label: "Corte", values: [["short", "Curto"], ["curly", "Cacheado"], ["mohawk", "Moicano"], ["bun", "Coque"]] },
  { key: "outfitStyle", label: "Roupa", values: [["classic", "Clássica"], ["jacket", "Jaqueta"], ["sport", "Esportiva"]] },
  { key: "faceStyle", label: "Rosto", values: [["classic", "Clássico"], ["freckles", "Sardas"], ["smile", "Sorriso"]] },
  { key: "headShape", label: "Cabeça", values: [["round", "Redonda"], ["oval", "Oval"], ["wide", "Larga"]] },
  { key: "accessory", label: "Acessório", values: [["none", "Nenhum"], ["headphones", "Fone"], ["cap", "Boné"], ["beanie", "Gorro"]] },
] as const;

const TABS = [
  { id: "look", label: "Visual", Icon: PaletteIcon },
  { id: "extras", label: "Extras", Icon: SparkleIcon },
] as const;

export default function AvatarCustomizer({ avatar, onChange, onClose }: AvatarCustomizerProps) {
  const [tab, setTab] = useState<"look" | "extras">("look");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function updateField<K extends keyof Avatar>(key: K, value: Avatar[K]) {
    onChange?.({
      ...avatar,
      [key]: value,
    });
  }

  return (
    <div className="avatar-modal" role="dialog" aria-modal="true" aria-label="Personalizar personagem">
      <div className="avatar-modal-backdrop" onClick={onClose} />
      <div className="avatar-modal-shell">
        <header className="avatar-modal-header">
          <div>
            <span className="avatar-panel-kicker">Personalização</span>
            <strong className="avatar-panel-title">Crie seu personagem</strong>
          </div>
          <button
            type="button"
            className="avatar-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="avatar-modal-body">
          <div className="avatar-stage-wrap">
            <Avatar3DPreview avatar={avatar} />
          </div>

          <div className="avatar-controls">
            <div className="avatar-tabs" role="tablist">
              {TABS.map((t) => {
                const TabIcon = t.Icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`avatar-tab ${tab === t.id ? "is-active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    <span className="avatar-tab-icon"><TabIcon /></span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="avatar-controls-scroll">
              {tab === "look" && (
                <div className="avatar-fields">
                  {COLOR_FIELDS.map((field) => {
                    const FieldIcon = field.Icon;
                    const color = avatar[field.key];
                    return (
                      <div key={field.key} className="avatar-field">
                        <div className="avatar-field-row">
                          <span className="avatar-field-icon" aria-hidden="true">
                            <FieldIcon />
                          </span>
                          <span className="avatar-field-label">{field.label}</span>
                          <label
                            className="avatar-field-picker"
                            style={{ background: color } as CSSProperties}
                            title="Cor personalizada"
                          >
                            <input
                              className="avatar-color-input"
                              type="color"
                              value={color}
                              onChange={(e) => updateField(field.key, e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="avatar-swatches">
                          {field.palette.map((paletteColor) => {
                            const selected = color.toLowerCase() === paletteColor.toLowerCase();
                            return (
                              <button
                                type="button"
                                key={paletteColor}
                                className={`avatar-swatch ${selected ? "is-selected" : ""}`}
                                style={{ background: paletteColor }}
                                onClick={() => updateField(field.key, paletteColor)}
                                aria-label={`${field.label} ${paletteColor}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "extras" && (
                <div className="avatar-extras">
                  <label className="avatar-extra-card">
                    <input
                      type="checkbox"
                      checked={avatar.backpackEnabled}
                      onChange={(e) => updateField("backpackEnabled", e.target.checked)}
                    />
                    <span className="avatar-extra-icon"><BackpackIcon /></span>
                    <span className="avatar-extra-text">
                      <strong>Mochila</strong>
                      <small>Leve seu material pra todo lado</small>
                    </span>
                  </label>
                  <label className="avatar-extra-card">
                    <input
                      type="checkbox"
                      checked={avatar.glasses}
                      onChange={(e) => updateField("glasses", e.target.checked)}
                    />
                    <span className="avatar-extra-icon"><GlassesIcon /></span>
                    <span className="avatar-extra-text">
                      <strong>Óculos</strong>
                      <small>Visual estudioso</small>
                    </span>
                  </label>
                  {STYLE_OPTIONS.map((option) => (
                    <div className="avatar-style-field" key={option.key}>
                      <strong>{option.label}</strong>
                      <div className="avatar-option-grid">
                        {option.values.map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={avatar[option.key] === value ? "is-selected" : ""}
                            onClick={() => updateField(option.key, value as Avatar[typeof option.key])}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="avatar-modal-footer">
          <button type="button" className="btn-play" onClick={onClose}>
            Pronto
          </button>
        </footer>
      </div>
    </div>
  );
}
