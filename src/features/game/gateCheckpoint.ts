import * as THREE from "three";
import type { Blocker } from "@/features/game/engineTypes";

type GateInteractable = {
  kind: string;
  label: string;
  radius: number;
  position: THREE.Vector3;
  root: THREE.Group;
  interact(): void;
  update(dt: number): void;
};

type CreateNameLabel = (
  text: string,
  color?: string,
  accent?: string
) => THREE.Group;

type GateCheckpointOptions = {
  container: HTMLElement | null | undefined;
  world: THREE.Group;
  interactables: GateInteractable[];
  createBlocker: (minX: number, maxX: number, minZ: number, maxZ: number) => Blocker;
  createNameLabel: CreateNameLabel;
  getDistance2D: (a: THREE.Vector3, b: THREE.Vector3) => number;
  player: { position: THREE.Vector3 };
  speak: (text: string, speaker?: string) => void;
  entryX: number;
  entryZ: number;
};

export function createGateCheckpoint({
  container,
  world,
  interactables,
  createBlocker,
  createNameLabel,
  getDistance2D,
  player,
  speak,
  entryX,
  entryZ,
}: GateCheckpointOptions) {
  const gateGroup = new THREE.Group();
  gateGroup.position.set(entryX, 0, entryZ + 1.4);
  world.add(gateGroup);

  const gateHud = document.createElement("div");
  gateHud.className = "gate-hud";
  gateHud.innerHTML = `
    <strong data-gate="phase">BLOQUEADO</strong>
    <span data-gate="hint">interaja com a catraca</span>
  `;
  container?.appendChild(gateHud);
  const gatePhaseEl = gateHud.querySelector<HTMLElement>('[data-gate="phase"]');
  const gateHintEl = gateHud.querySelector<HTMLElement>('[data-gate="hint"]');

  const gateModal = document.createElement("div");
  gateModal.className = "gate-modal";
  gateModal.innerHTML = `
    <div class="gate-modal-backdrop" data-gate-modal-close="true"></div>
    <form class="gate-modal-card" data-gate="form">
      <span class="gate-modal-kicker">Portaria</span>
      <strong>Liberar catraca</strong>
      <p>Digite sua matricula para acessar o campus.</p>
      <input
        class="gate-modal-input"
        data-gate="input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="12"
        placeholder="Somente numeros"
      />
      <div class="gate-modal-error" data-gate="error"></div>
      <div class="gate-modal-actions">
        <button type="button" class="gate-modal-button secondary" data-gate="cancel">Cancelar</button>
        <button type="submit" class="gate-modal-button">Liberar</button>
      </div>
    </form>
  `;
  container?.appendChild(gateModal);

  const gateFormEl = gateModal.querySelector<HTMLFormElement>('[data-gate="form"]');
  const gateInputEl = gateModal.querySelector<HTMLInputElement>('[data-gate="input"]');
  const gateErrorEl = gateModal.querySelector<HTMLElement>('[data-gate="error"]');
  const gateCancelEl = gateModal.querySelector<HTMLButtonElement>('[data-gate="cancel"]');

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x74838b,
    roughness: 0.42,
    metalness: 0.88,
  });
  const darkMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x3c474d,
    roughness: 0.58,
    metalness: 0.62,
  });
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 0.14, 4.4),
    new THREE.MeshStandardMaterial({ color: 0xc9c2b1, roughness: 0.96 })
  );
  floor.position.y = 0.07;
  floor.receiveShadow = true;
  gateGroup.add(floor);

  const postGeometry = new THREE.BoxGeometry(0.26, 1.3, 0.26);
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x55636a, roughness: 0.68, metalness: 0.25 });
  const armMaterial = metalMaterial;
  const indicatorMaterial = new THREE.MeshStandardMaterial({ color: 0xc6452f, emissive: 0x4a130d, emissiveIntensity: 0.2 });
  const posts = [-1.5, 1.5].map((offsetX) => {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(offsetX, 0.65, 0);
    post.castShadow = true;
    gateGroup.add(post);
    return post;
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.52, 1.05, 24),
    metalMaterial
  );
  body.position.set(0, 0.54, 0.02);
  body.castShadow = true;
  gateGroup.add(body);

  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.09, 24),
    darkMetalMaterial
  );
  topCap.position.set(0, 1.09, 0.02);
  topCap.castShadow = true;
  gateGroup.add(topCap);

  const reader = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.2, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x161d22, roughness: 0.45, metalness: 0.2 })
  );
  reader.position.set(0, 1, -0.46);
  reader.castShadow = true;
  gateGroup.add(reader);

  const readerGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.08, 0.03),
    new THREE.MeshStandardMaterial({
      color: 0xf2d45c,
      emissive: 0x7d6200,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.08,
    })
  );
  readerGlow.position.set(0, 1.01, -0.56);
  gateGroup.add(readerGlow);

  const armHub = new THREE.Group();
  armHub.position.set(0, 1.02, 0);
  gateGroup.add(armHub);

  for (let i = 0; i < 3; i += 1) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 1.22),
      armMaterial
    );
    arm.position.z = 0.61;
    arm.rotation.y = (Math.PI * 2 * i) / 3;
    arm.castShadow = true;
    armHub.add(arm);
  }

  const armCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.26, 18),
    darkMetalMaterial
  );
  armCore.rotation.x = Math.PI / 2;
  armCore.castShadow = true;
  armHub.add(armCore);

  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    indicatorMaterial
  );
  indicator.position.set(0, 1.52, -0.4);
  indicator.castShadow = true;
  gateGroup.add(indicator);

  const sideRailGeometry = new THREE.BoxGeometry(0.12, 0.94, 2.18);
  [-0.88, 0.88].forEach((offsetX) => {
    const rail = new THREE.Mesh(sideRailGeometry, darkMetalMaterial);
    rail.position.set(offsetX, 0.52, 0.2);
    rail.castShadow = true;
    gateGroup.add(rail);
  });

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.6, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x184d34, roughness: 0.82 })
  );
  header.position.set(0, 3.3, 0.1);
  header.castShadow = true;
  gateGroup.add(header);

  const gateLabel = createNameLabel("PORTARIA", "#f6f5ef", "#f3d24d");
  gateLabel.scale.set(3.8, 0.92, 1);
  gateLabel.position.set(0, 3.34, 0.32);
  gateLabel.renderOrder = 998;
  gateGroup.add(gateLabel);

  const instructionLabel = createNameLabel("DIGITE SUA MATRICULA", "#fff9dc", "#8ae59e");
  instructionLabel.scale.set(3.25, 0.72, 1);
  instructionLabel.position.set(0, 2.36, 0.32);
  instructionLabel.renderOrder = 998;
  gateGroup.add(instructionLabel);

  const gateBlocker = createBlocker(
    entryX - 2.1,
    entryX + 2.1,
    entryZ - 0.35,
    entryZ + 2.8
  );

  let unlocked = false;
  let armRotation = 0;
  let lastTyped = "";
  let modalOpen = false;

  function closeGateModal() {
    modalOpen = false;
    gateModal.classList.remove("visible");
    gateInputEl?.blur();
  }

  function openGateModal() {
    modalOpen = true;
    gateModal.classList.add("visible");
    if (gateInputEl) {
      gateInputEl.value = lastTyped;
      requestAnimationFrame(() => gateInputEl.focus());
      gateInputEl.select?.();
    }
    if (gateErrorEl) gateErrorEl.textContent = "";
  }

  function updateGateHud(visible: boolean) {
    gateHud.classList.toggle("visible", visible);
    gateHud.classList.toggle("unlocked", unlocked);
    if (gatePhaseEl) gatePhaseEl.textContent = unlocked ? "LIBERADO" : "BLOQUEADO";
    if (gateHintEl) gateHintEl.textContent = unlocked ? "" : modalOpen ? "digite sua matricula" : "interaja com a catraca";
  }

  gateFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (unlocked) {
      closeGateModal();
      return;
    }
    const typed = String(gateInputEl?.value || "").trim();
    if (!/^\d+$/.test(typed)) {
      lastTyped = typed.slice(0, 12);
      if (gateErrorEl) gateErrorEl.textContent = "Digite apenas numeros.";
      speak("Digite apenas numeros para validar sua matricula.", "Portaria");
      updateGateHud(true);
      gateInputEl?.focus();
      gateInputEl?.select?.();
      return;
    }

    lastTyped = typed.slice(0, 12);
    unlocked = true;
    closeGateModal();
    gateBlocker.active = false;
    indicatorMaterial.color.setHex(0x3fbf6b);
    indicatorMaterial.emissive.setHex(0x123f20);
    indicatorMaterial.emissiveIntensity = 0.35;
    readerGlow.material.color.setHex(0x8df5a6);
    readerGlow.material.emissive.setHex(0x1b6b31);
    speak("Matricula validada. Catraca liberada, acesso autorizado ao campus.", "Portaria");
    updateGateHud(true);
  });

  gateInputEl?.addEventListener("input", () => {
    const digitsOnly = String(gateInputEl.value || "").replace(/\D+/g, "").slice(0, 12);
    if (gateInputEl.value !== digitsOnly) gateInputEl.value = digitsOnly;
    lastTyped = digitsOnly;
    if (gateErrorEl) gateErrorEl.textContent = "";
    updateGateHud(true);
  });

  gateInputEl?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeGateModal();
      updateGateHud(true);
    }
  });

  gateCancelEl?.addEventListener("click", () => {
    closeGateModal();
    speak("Sem matricula, sem entrada. Tente novamente na catraca.", "Portaria");
    updateGateHud(true);
  });

  gateModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.gateModalClose === "true") {
      closeGateModal();
      updateGateHud(true);
    }
  });

  interactables.push({
    kind: "turnstile",
    label: "Digite sua matricula",
    radius: 3.2,
    position: new THREE.Vector3(entryX, 0, entryZ - 0.8),
    root: gateGroup,
    interact() {
      if (unlocked) {
        speak("A catraca ja foi liberada. Pode entrar no campus.", "Portaria");
        return;
      }
      openGateModal();
      updateGateHud(true);
    },
    update(dt) {
      gateBlocker.active = !unlocked;
      armRotation = THREE.MathUtils.lerp(
        armRotation,
        unlocked ? Math.PI * 0.66 : 0,
        Math.min(1, dt * (unlocked ? 4.5 : 8))
      );
      armHub.rotation.y = armRotation;
      posts[0].material.color.setHex(unlocked ? 0x4f6661 : 0x55636a);
      posts[1].material.color.setHex(unlocked ? 0x4f6661 : 0x55636a);
      this.label = unlocked ? "Entrada liberada" : "Digite sua matricula";
      const visible = getDistance2D(player.position, this.position) <= 5.4;
      updateGateHud(visible);
    },
  });

  return {
    destroy() {
      gateHud.remove();
      gateModal.remove();
    },
  };
}
