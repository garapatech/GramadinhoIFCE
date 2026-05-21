import * as THREE from "three";

export interface CampusNoticeState {
  clock?: string;
  label?: string;
  weatherLabel?: string;
  daylight?: number;
  weather?: {
    kind?: string;
    rain?: number;
    cloudMix?: number;
  };
}

export interface CampusNoticeTexture {
  texture: THREE.CanvasTexture;
  update(time?: number, state?: CampusNoticeState): void;
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create 2D canvas context");
  }
  return { canvas, ctx };
};

export function createGrassTexture() {
  const { canvas: c, ctx } = createCanvas(256, 256);
  ctx.fillStyle = "#6ea34e";
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 16000; i += 1) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const w = 1 + Math.random() * 2.5;
    const h = 1 + Math.random() * 2.5;
    const g = 95 + Math.random() * 55;
    ctx.fillStyle = `rgba(${40 + Math.random() * 20}, ${g}, ${35 + Math.random() * 16}, ${0.06 + Math.random() * 0.1})`;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(28, 28);
  texture.anisotropy = 8;
  return texture;
}

export function createWindowTexture() {
  const { canvas: c, ctx } = createCanvas(128, 128);
  ctx.fillStyle = "#9eb0b6";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#5d7881";
  ctx.fillRect(4, 4, 120, 120);
  for (let y = 12; y < 120; y += 22) {
    for (let x = 12; x < 120; x += 18) {
      const lit = Math.random() > 0.42;
      ctx.fillStyle = lit ? "#d7e8f2" : "#37505a";
      ctx.fillRect(x, y, 10, 14);
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createNoticeTexture(): CampusNoticeTexture {
  const { canvas, ctx } = createCanvas(512, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const noticeLines = [
    "Biblioteca aberta ate 21h",
    "Mutirao do gramado: sexta",
    "Sala de convivencia: bloco central",
    "Se chover, o corredor vira atalho de lenda",
    "A jardineira passa de novo em poucos minutos",
    "Quem chegar cedo encontra sombra e fofoca",
  ];

  const weatherLines = {
    rain: [
      "Leve guarda-chuva, o gramado agradece",
      "Poça nova perto do bloco central",
      "Chuva surpresa bagunça a saida da aula",
    ],
    cloudy: [
      "Nuvem de tarde, clima de corredor",
      "Dia bom pra andar sem pressa",
      "Se pintar vento, as arvores fazem barulho",
    ],
    night: [
      "Noite calma, luzes acesas perto dos blocos",
      "Campus em modo baixo volume",
      "Se ouvir eco, talvez seja so o patio",
    ],
  };

  function clearBoard(accentColor: string) {
    ctx.fillStyle = "#f2e7d8";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = accentColor;
    ctx.fillRect(14, 14, 484, 228);
    ctx.fillStyle = "#f7f2e9";
    ctx.fillRect(22, 22, 468, 212);
  }

  function drawLines(title: string, lines: string[], accentColor: string, footer?: string) {
    clearBoard(accentColor);
    ctx.fillStyle = accentColor;
    ctx.font = "bold 34px Arial";
    ctx.fillText(title, 44, 72);
    ctx.font = "22px Arial";
    lines.forEach((line, index) => {
      ctx.fillText(line, 44, 122 + index * 36);
    });
    if (footer) {
      ctx.fillStyle = "#567061";
      ctx.font = "18px Arial";
      ctx.fillText(footer, 44, 226);
    }
    texture.needsUpdate = true;
  }

  function pickLine(bucket: string[], time: number, offset = 0) {
    if (!bucket.length) return "";
    return bucket[Math.abs(Math.floor(time / 12 + offset)) % bucket.length];
  }

  function update(time = 0, state: CampusNoticeState = {}) {
    const weatherKind = state.weather?.kind || "";
    const isRainy = weatherKind === "rain" || (state.weather?.rain ?? 0) > 0.08;
    const isCloudy = weatherKind === "cloudy" || (state.weather?.cloudMix ?? 0) > 0.35;
    const isNight = (state.daylight ?? 1) < 0.26;
    const baseLines = [
      `Agora: ${state.clock || "--:--"} • ${state.label || "campus"}`,
      state.weatherLabel ? `Clima: ${state.weatherLabel}` : "Clima: observando o patio",
      pickLine(noticeLines, time, state.daylight || 0),
    ];

    if (isRainy) {
      drawLines(
        "Aviso de chuva",
        [
          `Agora: ${state.clock || "--:--"} • ${state.label || "campus"}`,
          state.weatherLabel ? `Clima: ${state.weatherLabel}` : "Clima: chuva ligeira",
          pickLine(weatherLines.rain, time, 1),
        ],
        "#2a5d7d",
        "Poças podem aparecer depois da chuva"
      );
      return;
    }

    if (isNight) {
      drawLines(
        "Aviso noturno",
        [
          `Agora: ${state.clock || "--:--"} • ${state.label || "campus"}`,
          state.weatherLabel ? `Clima: ${state.weatherLabel}` : "Clima: noite tranquila",
          pickLine(weatherLines.night, time, 2),
        ],
        "#5d6dc9",
        "Campus em modo baixo volume"
      );
      return;
    }

    drawLines(
      isCloudy ? "Avisos do Campus" : "Mural Vivo",
      [
        baseLines[0],
        baseLines[1],
        pickLine(isCloudy ? weatherLines.cloudy : noticeLines, time, 0.5),
      ],
      isCloudy ? "#345c4a" : "#234634",
      isCloudy ? "O mural muda com o clima" : "Volte mais tarde para outro recado"
    );
  }

  update(0, {
    clock: "07:30",
    label: "manhã",
    weatherLabel: "ensolarado",
    daylight: 0.82,
    weather: { kind: "clear", rain: 0, cloudMix: 0 },
  });

  return {
    texture,
    update,
  };
}

export function createBusSignTexture() {
  const { canvas: c, ctx } = createCanvas(256, 96);
  ctx.fillStyle = "#f5efe2";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "#1f6f43";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
  ctx.fillStyle = "#1f6f43";
  ctx.font = "bold 31px Arial";
  ctx.fillText("JARDINEIRA", 18, 47);
  ctx.font = "20px Arial";
  ctx.fillText("IFCE", 101, 72);
  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

export function createCampusBannerTexture() {
  const { canvas: c, ctx } = createCanvas(512, 256);

  const gradient = ctx.createLinearGradient(0, 0, c.width, c.height);
  gradient.addColorStop(0, "#184d34");
  gradient.addColorStop(0.55, "#1d6a45");
  gradient.addColorStop(1, "#f3d24d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  for (let i = -120; i < 620; i += 52) {
    ctx.beginPath();
    ctx.moveTo(i, 18);
    ctx.lineTo(i + 78, 18);
    ctx.lineTo(i + 118, 238);
    ctx.lineTo(i + 40, 238);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 488, 232);

  ctx.fillStyle = "#f8f6ef";
  ctx.font = "bold 70px Arial";
  ctx.fillText("IFCE", 42, 106);
  ctx.font = "bold 28px Arial";
  ctx.fillText("campus gramadinho", 44, 154);
  ctx.font = "22px Arial";
  ctx.fillText("vento, jardineira e conversa de corredor", 44, 190);

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

export function createCloudTexture() {
  const { canvas: c, ctx } = createCanvas(256, 128);
  ctx.clearRect(0, 0, c.width, c.height);

  const fillBlob = (x: number, y: number, r: number, alpha: number) => {
    const gradient = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  fillBlob(78, 58, 30, 0.9);
  fillBlob(108, 46, 36, 0.95);
  fillBlob(140, 60, 32, 0.92);
  fillBlob(172, 54, 26, 0.88);
  fillBlob(126, 68, 42, 0.7);

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}
