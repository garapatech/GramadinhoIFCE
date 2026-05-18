import { Suspense } from "react";
import GameView from "../../components/GameView";

export const dynamic = "force-dynamic";

export default function PlayPage() {
  return (
    <Suspense fallback={<div style={{ color: "#fff", padding: 24 }}>Carregando...</div>}>
      <GameView />
    </Suspense>
  );
}
