type NpcLike = {
  id: string;
  group: {
    position: { x: number; y: number; z: number };
    rotation: { y: number };
  };
  speed: number;
  pose?: { type?: string } | null;
  dancing?: boolean;
  danceTimer?: number;
  celebrateTimer?: number;
  state?: string;
  running?: boolean;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
  targetRy?: number;
  netAnim?: string;
  hasNetState?: boolean;
};

type NpcSnapshot = {
  id?: string;
  x?: number;
  y?: number;
  z?: number;
  ry?: number;
  speed?: number;
  anim?: string;
};

export type NpcNetState = {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  speed: number;
  anim: string;
};

export function getNpcNetAnim(npc: Pick<NpcLike, "pose" | "dancing" | "danceTimer" | "celebrateTimer" | "state" | "running">) {
  if (npc.pose?.type === "sit") return "sit";
  if (npc.dancing && npc.danceTimer > 0) return "dance";
  if (npc.celebrateTimer && npc.celebrateTimer > 0) return "celebrate";
  if (npc.state === "wander" || npc.state === "approach" || npc.state === "react") {
    return npc.running ? "run" : "walk";
  }
  return "idle";
}

export function createNpcSync() {
  let authorityActive = false;

  function setNpcAuthority(active: boolean) {
    authorityActive = active === true;
  }

  function serializeNpcStates(npcs: NpcLike[]): NpcNetState[] {
    return npcs.map((npc) => ({
      id: npc.id,
      x: npc.group.position.x,
      y: npc.group.position.y,
      z: npc.group.position.z,
      ry: npc.group.rotation.y,
      speed: npc.speed,
      anim: getNpcNetAnim(npc),
    }));
  }

  function applyNpcSnapshots(npcById: Map<string, NpcLike>, snapshots: NpcSnapshot[] = []) {
    if (authorityActive) return;
    for (const snapshot of snapshots) {
      const npc = npcById.get(snapshot?.id || "");
      if (!npc) continue;
      if (typeof snapshot.x === "number") npc.targetX = snapshot.x;
      if (typeof snapshot.y === "number") npc.targetY = snapshot.y;
      if (typeof snapshot.z === "number") npc.targetZ = snapshot.z;
      if (typeof snapshot.ry === "number") npc.targetRy = snapshot.ry;
      npc.netAnim = typeof snapshot.anim === "string" ? snapshot.anim : "idle";
      if (typeof snapshot.speed === "number") npc.speed = snapshot.speed;
      npc.hasNetState = true;
    }
  }

  return {
    setNpcAuthority,
    isNpcAuthorityActive: () => authorityActive,
    serializeNpcStates,
    applyNpcSnapshots,
  };
}
