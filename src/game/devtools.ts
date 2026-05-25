import * as THREE from "three";

type DevTarget = {
  object: THREE.Object3D;
  label: string;
  kind: string;
  entityType?: string;
  entity?: DevTargetEntity;
  position?: THREE.Vector3;
  pickRadius: number;
};

type DevTargetEntity = DevInteractableEntity | DevNpcEntity | DevBirdEntity | DevBikeEntity | THREE.Object3D;

type DevInteractableEntity = {
  root?: THREE.Object3D;
  kind?: string;
  label?: string;
  position?: THREE.Vector3;
  radius?: number;
  npcApproachRadius?: number;
};

type DevNpcEntity = {
  group: THREE.Group;
  name: string;
  home: THREE.Vector3;
  moveTarget: THREE.Vector3;
  targetX: number;
  targetZ: number;
  pause: number;
  focus: unknown;
  pose: unknown;
};

type DevBirdEntity = {
  group: THREE.Group;
  name: string;
  home: THREE.Vector3;
  target: THREE.Vector3;
  waitTimer: number;
  wanderTimer: number;
  fleeTimer: number;
};

type DevBikeEntity = {
  group: THREE.Object3D;
  targetX: number;
  targetZ: number;
  hasSharedState: boolean;
  emitState?: (hasState: boolean) => void;
};

export interface DevToolsController {
  isEnabled(): boolean;
  handleKeyDown(event: KeyboardEvent): boolean;
  handlePointerDown(event: MouseEvent): boolean;
  handlePointerMove(event: MouseEvent): boolean;
  handlePointerUp(event: MouseEvent): boolean;
  updateSelectionBox(): void;
  destroy(): void;
}

interface DevToolsContext {
  scene: THREE.Scene;
  world: THREE.Group;
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  player: THREE.Object3D;
  interactables: DevInteractableEntity[];
  npcs: DevNpcEntity[];
  ducks: DevBirdEntity[];
  pigeons: DevBirdEntity[];
  sharedBikes: Map<string, DevBikeEntity>;
  clearInputState: () => void;
  stopCameraDrag: () => void;
  stopPlayerMotion: () => void;
}

const DEV_GAMEPLAY_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyE",
  "Space",
  "KeyG",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
]);

export function createDevTools({
  scene,
  world,
  container,
  canvas,
  renderer,
  camera,
  player,
  interactables,
  npcs,
  ducks,
  pigeons,
  sharedBikes,
  clearInputState,
  stopCameraDrag,
  stopPlayerMotion,
}: DevToolsContext): DevToolsController {
  const devRaycaster = new THREE.Raycaster();
  const devPointerNdc = new THREE.Vector2();
  const devGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const devGroundPoint = new THREE.Vector3();
  const devDragOffset = new THREE.Vector3();
  const devObjectWorldPosition = new THREE.Vector3();
  const devParentLocalPosition = new THREE.Vector3();
  const devSelectionBox = new THREE.BoxHelper(world, 0x62ff9f);
  devSelectionBox.visible = false;
  devSelectionBox.renderOrder = 1000;
  devSelectionBox.material.depthTest = false;
  scene.add(devSelectionBox);

  const devOverlay = document.createElement("div");
  devOverlay.className = "dev-tools-panel";
  devOverlay.hidden = true;
  container.appendChild(devOverlay);

  const devPointer = {
    cssX: 0,
    cssY: 0,
    deviceX: 0,
    deviceY: 0,
    worldX: 0,
    worldZ: 0,
    hasWorld: false,
  };

  let devMode = false;
  let devSelected: DevTarget | null = null;
  let devDragging = false;
  let devSelectionMoved = false;

  function formatDevNumber(value: number, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : "--";
  }

  function escapeDevText(value: unknown) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCanvasPointer(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const cssX = THREE.MathUtils.clamp(event.clientX - rect.left, 0, width);
    const cssY = THREE.MathUtils.clamp(event.clientY - rect.top, 0, height);
    const pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : window.devicePixelRatio || 1;

    devPointer.cssX = cssX;
    devPointer.cssY = cssY;
    devPointer.deviceX = cssX * pixelRatio;
    devPointer.deviceY = cssY * pixelRatio;
    devPointerNdc.set((cssX / width) * 2 - 1, -(cssY / height) * 2 + 1);
    return devPointer;
  }

  function updateDevGroundPoint(event: MouseEvent) {
    getCanvasPointer(event);
    devRaycaster.setFromCamera(devPointerNdc, camera);
    const hit = devRaycaster.ray.intersectPlane(devGroundPlane, devGroundPoint);
    devPointer.hasWorld = !!hit;
    if (hit) {
      devPointer.worldX = hit.x;
      devPointer.worldZ = hit.z;
    }
    return hit;
  }

  function getDevTargetWorldPosition(target: DevTarget, out = devObjectWorldPosition) {
    if (!target?.object) return out.set(0, 0, 0);
    return target.object.getWorldPosition(out);
  }

  function findBikeStateByGroup(group: THREE.Object3D) {
    for (const bike of sharedBikes.values()) {
      if (bike.group === group) return bike;
    }
    return null;
  }

  function collectDevTargets() {
    const targets: DevTarget[] = [];
    const seen = new Set<string>();

    function addTarget({
      object,
      label,
      kind,
      entityType,
      entity,
      position,
      pickRadius = 1.8,
    }: {
      object?: THREE.Object3D;
      label?: string;
      kind?: string;
      entityType?: string;
      entity?: DevTargetEntity;
      position?: THREE.Vector3;
      pickRadius?: number;
    }) {
      if (!object || seen.has(object.uuid)) return;
      seen.add(object.uuid);
      targets.push({
        object,
        label: label || kind || object.name || "Objeto",
        kind: kind || "objeto",
        entityType,
        entity,
        position,
        pickRadius,
      });
    }

    addTarget({
      object: player,
      label: "Jogador local",
      kind: "player",
      entityType: "player",
      entity: player,
      position: player.position,
      pickRadius: 1.4,
    });

    for (const item of interactables) {
      if (!item?.root || item.kind === "door" || item.kind === "bus") continue;
      addTarget({
        object: item.root,
        label: item.label,
        kind: item.kind || "interagivel",
        entityType: "interactable",
        entity: item,
        position: item.position,
        pickRadius: Math.max(1.4, item.radius || item.npcApproachRadius || 1.8),
      });
    }

    for (const npc of npcs) {
      addTarget({
        object: npc.group,
        label: npc.name,
        kind: "npc",
        entityType: "npc",
        entity: npc,
        position: npc.group.position,
        pickRadius: 1.6,
      });
    }

    for (const duck of ducks) {
      addTarget({
        object: duck.group,
        label: duck.name,
        kind: "duck",
        entityType: "duck",
        entity: duck,
        position: duck.group.position,
        pickRadius: 1.2,
      });
    }

    for (const pigeon of pigeons) {
      addTarget({
        object: pigeon.group,
        label: pigeon.name,
        kind: "pigeon",
        entityType: "pigeon",
        entity: pigeon,
        position: pigeon.group.position,
        pickRadius: 1,
      });
    }

    return targets;
  }

  function resolveDevTargetFromObject(object: THREE.Object3D, targetByUuid: Map<string, DevTarget>) {
    let current: THREE.Object3D | null = object;
    while (current) {
      const target = targetByUuid.get(current.uuid);
      if (target) return target;
      current = current.parent;
    }
    return null;
  }

  function pickDevTarget(event: MouseEvent) {
    const groundHit = updateDevGroundPoint(event);
    const targets = collectDevTargets();
    const targetByUuid = new Map<string, DevTarget>();
    const roots: THREE.Object3D[] = [];

    for (const target of targets) {
      target.object.traverse?.((node) => targetByUuid.set(node.uuid, target));
      roots.push(target.object);
    }

    devRaycaster.setFromCamera(devPointerNdc, camera);
    const hits = devRaycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const target = resolveDevTargetFromObject(hit.object, targetByUuid);
      if (target) return target;
    }

    if (!groundHit) return null;

    let fallback: DevTarget | null = null;
    let fallbackDistance = Infinity;
    for (const target of targets) {
      const position = getDevTargetWorldPosition(target);
      const distance = Math.hypot(position.x - groundHit.x, position.z - groundHit.z);
      if (distance <= target.pickRadius && distance < fallbackDistance) {
        fallback = target;
        fallbackDistance = distance;
      }
    }
    return fallback;
  }

  function applyDevMove(target: DevTarget, worldX: number, worldZ: number) {
    if (!target?.object) return;
    const x = THREE.MathUtils.clamp(worldX, -68, 68);
    const z = THREE.MathUtils.clamp(worldZ, -68, 68);

    if (target.object.parent) {
      devParentLocalPosition.set(x, 0, z);
      target.object.parent.worldToLocal(devParentLocalPosition);
      target.object.position.x = devParentLocalPosition.x;
      target.object.position.z = devParentLocalPosition.z;
    } else {
      target.object.position.x = x;
      target.object.position.z = z;
    }

    if (target.position) {
      target.position.x = x;
      target.position.z = z;
    }

    if (target.entityType === "npc" && target.entity) {
      const npc = target.entity as DevNpcEntity;
      npc.home.set(x, 0, z);
      npc.moveTarget.set(x, 0, z);
      npc.targetX = x;
      npc.targetZ = z;
      npc.pause = 0.6;
      npc.focus = null;
      npc.pose = null;
    } else if ((target.entityType === "duck" || target.entityType === "pigeon") && target.entity) {
      const bird = target.entity as DevBirdEntity;
      bird.home.set(x, 0, z);
      bird.target.set(x, 0, z);
      bird.waitTimer = 0.4;
      bird.wanderTimer = 0.4;
      bird.fleeTimer = 0;
    } else if (target.entityType === "interactable" && target.entity) {
      const bike = findBikeStateByGroup(target.object);
      if (bike) {
        bike.targetX = x;
        bike.targetZ = z;
        bike.hasSharedState = false;
        bike.emitState?.(false);
      }
    }

    if (target.entityType === "player") {
      stopPlayerMotion();
    }

    devSelectionMoved = true;
    updateDevSelectionBox();
    updateDevOverlay();
  }

  function moveDevSelectionBy(dx: number, dz: number) {
    if (!devSelected) return false;
    const position = getDevTargetWorldPosition(devSelected);
    applyDevMove(devSelected, position.x + dx, position.z + dz);
    return true;
  }

  function setDevSelected(target: DevTarget | null) {
    devSelected = target;
    devSelectionMoved = false;
    updateDevSelectionBox();
    updateDevOverlay();
  }

  function updateDevSelectionBox() {
    if (!devSelected?.object || !devMode) {
      devSelectionBox.visible = false;
      return;
    }
    devSelectionBox.setFromObject(devSelected.object);
    devSelectionBox.visible = true;
  }

  function updateDevCursor() {
    if (!canvas?.style) return;
    if (!devMode) {
      canvas.style.cursor = "";
      return;
    }
    canvas.style.cursor = devDragging ? "grabbing" : devSelected ? "grab" : "crosshair";
  }

  function updateDevOverlay() {
    if (!devMode) {
      devOverlay.hidden = true;
      return;
    }

    devOverlay.hidden = false;
    const selectedPosition = devSelected ? getDevTargetWorldPosition(devSelected) : null;
    const selectedLabel = devSelected ? `${devSelected.label} (${devSelected.kind})` : "nenhum";
    const selectedLine = selectedPosition
      ? `pos x ${formatDevNumber(selectedPosition.x)} / z ${formatDevNumber(selectedPosition.z)}`
      : "clique em um objeto para selecionar";

    devOverlay.innerHTML = `
      <div class="dev-tools-title">Modo desenvolvedor</div>
      <div class="dev-tools-grid">
        <span>pixel CSS</span><strong>${formatDevNumber(devPointer.cssX, 0)}, ${formatDevNumber(devPointer.cssY, 0)}</strong>
        <span>pixel canvas</span><strong>${formatDevNumber(devPointer.deviceX, 0)}, ${formatDevNumber(devPointer.deviceY, 0)}</strong>
        <span>mundo</span><strong>${devPointer.hasWorld ? `x ${formatDevNumber(devPointer.worldX)} / z ${formatDevNumber(devPointer.worldZ)}` : "--"}</strong>
        <span>seleção</span><strong>${escapeDevText(selectedLabel)}</strong>
        <span>posição</span><strong>${selectedLine}</strong>
      </div>
      <div class="dev-tools-help">
        F2 liga/desliga · clique e arraste move · setas ajustam · Shift = passo maior · Alt = fino · Esc limpa
      </div>
      ${devSelectionMoved && selectedPosition ? `<div class="dev-tools-copy">Use x ${formatDevNumber(selectedPosition.x)} / z ${formatDevNumber(selectedPosition.z)} no código se quiser persistir.</div>` : ""}
    `;
  }

  function setDevMode(nextMode: boolean) {
    devMode = nextMode === true;
    devDragging = false;
    stopCameraDrag();
    clearInputState();
    if (!devMode) {
      setDevSelected(null);
    }
    updateDevCursor();
    updateDevSelectionBox();
    updateDevOverlay();
  }

  function handleDevKeyDown(event: KeyboardEvent) {
    if (event.code === "F2" && !event.repeat) {
      event.preventDefault();
      setDevMode(!devMode);
      return true;
    }

    if (!devMode) return false;

    if (event.code === "Escape") {
      event.preventDefault();
      setDevSelected(null);
      return true;
    }

    const nudgeStep = event.altKey ? 0.05 : event.shiftKey ? 1 : 0.25;
    const nudgeByCode: Record<string, [number, number]> = {
      ArrowUp: [0, -nudgeStep],
      ArrowDown: [0, nudgeStep],
      ArrowLeft: [-nudgeStep, 0],
      ArrowRight: [nudgeStep, 0],
    };
    const nudge = nudgeByCode[event.code];
    if (nudge) {
      event.preventDefault();
      moveDevSelectionBy(nudge[0], nudge[1]);
      return true;
    }

    if (DEV_GAMEPLAY_KEYS.has(event.code)) {
      event.preventDefault();
      return true;
    }

    return false;
  }

  function handleDevPointerDown(event: MouseEvent) {
    if (!devMode || event.button !== 0) return false;
    event.preventDefault();
    event.stopPropagation();
    const hit = updateDevGroundPoint(event);
    const target = pickDevTarget(event);
    setDevSelected(target);

    if (target && hit) {
      const position = getDevTargetWorldPosition(target);
      devDragOffset.set(position.x - hit.x, 0, position.z - hit.z);
      devDragging = true;
    }

    updateDevCursor();
    return true;
  }

  function handleDevPointerMove(event: MouseEvent) {
    if (!devMode) return false;
    const hit = updateDevGroundPoint(event);

    if (devDragging && devSelected && hit) {
      event.preventDefault();
      applyDevMove(devSelected, hit.x + devDragOffset.x, hit.z + devDragOffset.z);
      return true;
    }

    updateDevOverlay();
    return false;
  }

  function handleDevPointerUp(event: MouseEvent) {
    if (!devMode || !devDragging) return false;
    event.preventDefault();
    devDragging = false;
    updateDevCursor();
    updateDevOverlay();
    return true;
  }

  function destroy() {
    devOverlay.remove();
    scene.remove(devSelectionBox);
  }

  return {
    isEnabled: () => devMode,
    handleKeyDown: (event) => handleDevKeyDown(event),
    handlePointerDown: (event) => handleDevPointerDown(event),
    handlePointerMove: (event) => handleDevPointerMove(event),
    handlePointerUp: (event) => handleDevPointerUp(event),
    updateSelectionBox,
    destroy,
  };

  function updateSelectionBox() {
    updateDevSelectionBox();
  }
}
