const baseProps = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function ShirtIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8 3l-5 3 2 4 3-1v12h12V9l3 1 2-4-5-3-3 2h-6L8 3z" />
    </svg>
  );
}

export function PantsIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 3h14l-1 8-1 10h-4l-1-9-1 9H7L6 11 5 3z" />
      <path d="M5 3h14" />
    </svg>
  );
}

export function ShoesIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M2 16c0-1 1-2 2-2h3l3-5 4 2v3l6 2c1 .3 2 1 2 2v1H2v-3z" />
      <path d="M7 14l-1 3M11 14l-1 3M15 16l-1 3" />
    </svg>
  );
}

export function SkinIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="9" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}

export function HairIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 14c0-5 4-9 8-9s8 4 8 9" />
      <path d="M4 14c0 2 1 4 3 5M20 14c0 2-1 4-3 5" />
      <path d="M7 12c1-2 3-3 5-3s4 1 5 3" />
    </svg>
  );
}

export function BackpackIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z" />
      <path d="M9 4V3a3 3 0 0 1 6 0v1" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

export function GlassesIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="6.5" cy="14" r="3.5" />
      <circle cx="17.5" cy="14" r="3.5" />
      <path d="M10 14h4" />
      <path d="M3 11l2-4M21 11l-2-4" />
    </svg>
  );
}

export function PaletteIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1-2-1-3 0-1 1-2 2-2h2a4 4 0 0 0 4-4 9 9 0 0 0-9-7z" />
      <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SparkleIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M18 16l.7 2 2 .7-2 .7L18 21l-.7-1.7-2-.7 2-.7L18 16z" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
