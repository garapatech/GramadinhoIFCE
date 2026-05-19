"use client";

const COLOR_FIELDS = [
  { key: "shirt", label: "Camisa" },
  { key: "pants", label: "Calça" },
  { key: "shoes", label: "Tênis" },
  { key: "skin", label: "Pele" },
  { key: "backpack", label: "Mochila" },
  { key: "hair", label: "Cabelo" },
];

export default function AvatarCustomizer({ avatar, onChange }) {
  function updateField(key, value) {
    onChange?.({
      ...avatar,
      [key]: value,
    });
  }

  return (
    <section className="avatar-panel">
      <div className="avatar-panel-head">
        <div>
          <span className="avatar-panel-kicker">Personalização</span>
          <strong className="avatar-panel-title">Seu personagem</strong>
        </div>
        <div
          className="avatar-preview"
          style={{
            "--avatar-shirt": avatar.shirt,
            "--avatar-pants": avatar.pants,
            "--avatar-shoes": avatar.shoes,
            "--avatar-skin": avatar.skin,
            "--avatar-backpack": avatar.backpack,
            "--avatar-hair": avatar.hair,
          }}
          aria-hidden="true"
        >
          <div className="avatar-preview-backpack" data-visible={avatar.backpackEnabled ? "1" : "0"} />
          <div className="avatar-preview-head-shape" />
          <div className="avatar-preview-hair" />
          <div className="avatar-preview-glasses" data-visible={avatar.glasses ? "1" : "0"} />
          <div className="avatar-preview-torso" />
          <div className="avatar-preview-arm left" />
          <div className="avatar-preview-arm right" />
          <div className="avatar-preview-leg left" />
          <div className="avatar-preview-leg right" />
          <div className="avatar-preview-shoe left" />
          <div className="avatar-preview-shoe right" />
        </div>
      </div>

      <div className="avatar-grid">
        {COLOR_FIELDS.map((field) => (
          <label key={field.key} className="avatar-field">
            <span className="avatar-field-label">{field.label}</span>
            <span className="avatar-color-box">
              <input
                className="avatar-color-input"
                type="color"
                value={avatar[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
              />
              <span className="avatar-color-value">{avatar[field.key]}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="avatar-toggles">
        <label className="avatar-toggle">
          <input
            type="checkbox"
            checked={avatar.backpackEnabled}
            onChange={(event) => updateField("backpackEnabled", event.target.checked)}
          />
          <span>Mochila</span>
        </label>
        <label className="avatar-toggle">
          <input
            type="checkbox"
            checked={avatar.glasses}
            onChange={(event) => updateField("glasses", event.target.checked)}
          />
          <span>Óculos</span>
        </label>
      </div>
    </section>
  );
}
