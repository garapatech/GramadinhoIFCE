// Xadrez basico (Texas/FIDE simplificado). Sem castling/en passant.
// Promocao de peao automatica para dama. Detecta xeque, mate e empate.

export type ChessColor = "w" | "b";
export type ChessPieceKind = "P" | "N" | "B" | "R" | "Q" | "K";
export type ChessPiece = { color: ChessColor; kind: ChessPieceKind };
export type ChessSquare = { file: number; rank: number }; // 0..7

export type ChessBoard = (ChessPiece | null)[][]; // [rank][file]

export type ChessPhase = "waiting" | "playing" | "ended";

export type ChessSeatPublic = {
  color: ChessColor;
  playerId: string | null;
  nick: string;
};

export type ChessMoveRecord = {
  piece: ChessPieceKind;
  from: ChessSquare;
  to: ChessSquare;
  captured: ChessPieceKind | null;
  promoted: ChessPieceKind | null;
  san: string; // notacao curta para historico
};

export type ChessPublicState = {
  phase: ChessPhase;
  seats: ChessSeatPublic[];
  board: ChessBoard;
  turn: ChessColor;
  moves: ChessMoveRecord[];
  capturedByWhite: ChessPieceKind[];
  capturedByBlack: ChessPieceKind[];
  inCheck: ChessColor | null;
  result: "white" | "black" | "draw" | null;
  resultReason: string | null;
  log: string[];
};

export type ChessMoveResult =
  | { ok: true; gameEnded: boolean }
  | { ok: false; error: string };

const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];

function initialBoard(): ChessBoard {
  const board: ChessBoard = Array.from({ length: 8 }, () =>
    Array<ChessPiece | null>(8).fill(null),
  );
  const backRow: ChessPieceKind[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let f = 0; f < 8; f++) {
    board[0][f] = { color: "w", kind: backRow[f] };
    board[1][f] = { color: "w", kind: "P" };
    board[6][f] = { color: "b", kind: "P" };
    board[7][f] = { color: "b", kind: backRow[f] };
  }
  return board;
}

function inside(file: number, rank: number) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function pieceAt(board: ChessBoard, sq: ChessSquare): ChessPiece | null {
  if (!inside(sq.file, sq.rank)) return null;
  return board[sq.rank][sq.file];
}

function clone(board: ChessBoard): ChessBoard {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function squareLabel(sq: ChessSquare): string {
  return `${FILE_LABELS[sq.file]}${sq.rank + 1}`;
}

// Lista todos os movimentos pseudo-legais (nao checa rei em xeque) da cor
function generatePseudoMoves(
  board: ChessBoard,
  color: ChessColor,
): Array<{ from: ChessSquare; to: ChessSquare }> {
  const out: Array<{ from: ChessSquare; to: ChessSquare }> = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p || p.color !== color) continue;
      const from = { file: f, rank: r };
      const dests = generateDestinationsFor(board, from, p);
      for (const to of dests) out.push({ from, to });
    }
  }
  return out;
}

function generateDestinationsFor(
  board: ChessBoard,
  from: ChessSquare,
  piece: ChessPiece,
): ChessSquare[] {
  const dests: ChessSquare[] = [];
  const { file: f, rank: r } = from;

  const push = (df: number, dr: number) => {
    const to = { file: df, rank: dr };
    if (!inside(df, dr)) return false;
    const target = board[dr][df];
    if (target && target.color === piece.color) return false;
    dests.push(to);
    return target === null; // empty: pode continuar; ocupado: parar
  };

  if (piece.kind === "P") {
    const dir = piece.color === "w" ? 1 : -1;
    const startRank = piece.color === "w" ? 1 : 6;
    // Frente 1
    if (inside(f, r + dir) && board[r + dir][f] === null) {
      dests.push({ file: f, rank: r + dir });
      // Frente 2 (so do rank inicial e se ambos vazios)
      if (r === startRank && board[r + 2 * dir][f] === null) {
        dests.push({ file: f, rank: r + 2 * dir });
      }
    }
    // Capturas diagonais
    for (const df of [-1, 1]) {
      const nf = f + df;
      const nr = r + dir;
      if (inside(nf, nr) && board[nr][nf] && board[nr][nf]!.color !== piece.color) {
        dests.push({ file: nf, rank: nr });
      }
    }
  } else if (piece.kind === "N") {
    const offsets: Array<[number, number]> = [
      [1, 2], [2, 1], [-1, 2], [-2, 1],
      [1, -2], [2, -1], [-1, -2], [-2, -1],
    ];
    for (const [df, dr] of offsets) push(f + df, r + dr);
  } else if (piece.kind === "B" || piece.kind === "R" || piece.kind === "Q") {
    const dirs: Array<[number, number]> = [];
    if (piece.kind === "B" || piece.kind === "Q") {
      dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }
    if (piece.kind === "R" || piece.kind === "Q") {
      dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }
    for (const [df, dr] of dirs) {
      let nf = f + df;
      let nr = r + dr;
      while (inside(nf, nr)) {
        const target = board[nr][nf];
        if (target && target.color === piece.color) break;
        dests.push({ file: nf, rank: nr });
        if (target) break;
        nf += df;
        nr += dr;
      }
    }
  } else if (piece.kind === "K") {
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        push(f + df, r + dr);
      }
    }
  }

  return dests;
}

function findKing(board: ChessBoard, color: ChessColor): ChessSquare | null {
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.color === color && p.kind === "K") return { file: f, rank: r };
    }
  }
  return null;
}

function squareAttacked(
  board: ChessBoard,
  sq: ChessSquare,
  byColor: ChessColor,
): boolean {
  // Reutiliza pseudo-moves do atacante; se algum cai sobre sq, esta atacada
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p || p.color !== byColor) continue;
      const dests = generateDestinationsFor(board, { file: f, rank: r }, p);
      for (const d of dests) {
        if (d.file === sq.file && d.rank === sq.rank) return true;
      }
    }
  }
  return false;
}

function isInCheck(board: ChessBoard, color: ChessColor): boolean {
  const k = findKing(board, color);
  if (!k) return false;
  return squareAttacked(board, k, color === "w" ? "b" : "w");
}

function generateLegalMoves(board: ChessBoard, color: ChessColor) {
  const pseudo = generatePseudoMoves(board, color);
  const legal: Array<{ from: ChessSquare; to: ChessSquare }> = [];
  for (const m of pseudo) {
    const next = clone(board);
    const piece = next[m.from.rank][m.from.file]!;
    // Promocao automatica
    let placed: ChessPiece = piece;
    if (piece.kind === "P") {
      const promoRank = piece.color === "w" ? 7 : 0;
      if (m.to.rank === promoRank) placed = { color: piece.color, kind: "Q" };
    }
    next[m.from.rank][m.from.file] = null;
    next[m.to.rank][m.to.file] = placed;
    if (!isInCheck(next, color)) legal.push(m);
  }
  return legal;
}

const PIECE_NAMES_PT: Record<ChessPieceKind, string> = {
  P: "peao",
  N: "cavalo",
  B: "bispo",
  R: "torre",
  Q: "dama",
  K: "rei",
};

export class ChessTable {
  seats: { w: ChessSeatPublic; b: ChessSeatPublic };
  board: ChessBoard = initialBoard();
  turn: ChessColor = "w";
  phase: ChessPhase = "waiting";
  moves: ChessMoveRecord[] = [];
  capturedByWhite: ChessPieceKind[] = [];
  capturedByBlack: ChessPieceKind[] = [];
  result: "white" | "black" | "draw" | null = null;
  resultReason: string | null = null;
  log: string[] = [];

  constructor() {
    this.seats = {
      w: { color: "w", playerId: null, nick: "" },
      b: { color: "b", playerId: null, nick: "" },
    };
  }

  private pushLog(text: string) {
    this.log.push(text);
    if (this.log.length > 40) this.log.splice(0, this.log.length - 40);
  }

  sit(color: ChessColor, playerId: string, nick: string): { ok: boolean; error?: string } {
    const seat = this.seats[color];
    if (seat.playerId === playerId) return { ok: true };
    if (seat.playerId) return { ok: false, error: "Cor ocupada" };
    if (this.seats.w.playerId === playerId || this.seats.b.playerId === playerId) {
      return { ok: false, error: "Voce ja esta jogando" };
    }
    seat.playerId = playerId;
    seat.nick = nick;
    this.pushLog(`${nick} sentou nas ${color === "w" ? "brancas" : "pretas"}`);
    if (this.seats.w.playerId && this.seats.b.playerId && this.phase === "waiting") {
      this.startGame();
    }
    return { ok: true };
  }

  stand(playerId: string): boolean {
    let changed = false;
    for (const color of ["w", "b"] as ChessColor[]) {
      const seat = this.seats[color];
      if (seat.playerId === playerId) {
        this.pushLog(`${seat.nick} saiu do xadrez (${color === "w" ? "brancas" : "pretas"})`);
        seat.playerId = null;
        seat.nick = "";
        changed = true;
        // Se jogo em andamento, oponente vence por desistencia
        if (this.phase === "playing") {
          this.result = color === "w" ? "black" : "white";
          this.resultReason = "Desistencia";
          this.phase = "ended";
          this.pushLog(`Vitoria das ${color === "w" ? "pretas" : "brancas"} por desistencia`);
        }
      }
    }
    return changed;
  }

  startGame() {
    this.board = initialBoard();
    this.turn = "w";
    this.moves = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.result = null;
    this.resultReason = null;
    this.phase = "playing";
    this.pushLog("Partida iniciada");
  }

  resetIfFinished() {
    if (this.phase === "ended" && this.seats.w.playerId && this.seats.b.playerId) {
      this.startGame();
    }
  }

  publicState(): ChessPublicState {
    return {
      phase: this.phase,
      seats: [
        { ...this.seats.w },
        { ...this.seats.b },
      ],
      board: clone(this.board),
      turn: this.turn,
      moves: this.moves.slice(),
      capturedByWhite: this.capturedByWhite.slice(),
      capturedByBlack: this.capturedByBlack.slice(),
      inCheck: isInCheck(this.board, this.turn) ? this.turn : null,
      result: this.result,
      resultReason: this.resultReason,
      log: this.log.slice(),
    };
  }

  move(playerId: string, from: ChessSquare, to: ChessSquare): ChessMoveResult {
    if (this.phase !== "playing") return { ok: false, error: "Jogo nao esta em andamento" };
    const seat = this.seats[this.turn];
    if (seat.playerId !== playerId) return { ok: false, error: "Nao e sua vez" };

    const piece = pieceAt(this.board, from);
    if (!piece || piece.color !== this.turn) {
      return { ok: false, error: "Peca invalida" };
    }
    const legal = generateLegalMoves(this.board, this.turn);
    const isLegal = legal.some(
      (m) => m.from.file === from.file && m.from.rank === from.rank &&
        m.to.file === to.file && m.to.rank === to.rank,
    );
    if (!isLegal) return { ok: false, error: "Movimento invalido" };

    const captured = pieceAt(this.board, to);
    let placed: ChessPiece = piece;
    let promoted: ChessPieceKind | null = null;
    if (piece.kind === "P") {
      const promoRank = piece.color === "w" ? 7 : 0;
      if (to.rank === promoRank) {
        placed = { color: piece.color, kind: "Q" };
        promoted = "Q";
      }
    }
    this.board[from.rank][from.file] = null;
    this.board[to.rank][to.file] = placed;

    if (captured) {
      if (captured.color === "b") this.capturedByWhite.push(captured.kind);
      else this.capturedByBlack.push(captured.kind);
    }

    const san =
      `${piece.kind === "P" ? "" : piece.kind}` +
      `${squareLabel(from)}${captured ? "x" : "-"}${squareLabel(to)}` +
      `${promoted ? "=Q" : ""}`;

    this.moves.push({
      piece: piece.kind,
      from,
      to,
      captured: captured?.kind ?? null,
      promoted,
      san,
    });
    this.pushLog(
      `${seat.nick || (this.turn === "w" ? "Brancas" : "Pretas")} jogou ${PIECE_NAMES_PT[piece.kind]} ${san}` +
        (captured ? ` (capturou ${PIECE_NAMES_PT[captured.kind]})` : "") +
        (promoted ? " (promoveu)" : ""),
    );

    this.turn = this.turn === "w" ? "b" : "w";

    // Verifica fim de jogo
    const oppLegal = generateLegalMoves(this.board, this.turn);
    if (oppLegal.length === 0) {
      const inCheck = isInCheck(this.board, this.turn);
      if (inCheck) {
        this.result = this.turn === "w" ? "black" : "white";
        this.resultReason = "Xeque-mate";
        this.pushLog(`Xeque-mate! ${this.turn === "w" ? "Pretas" : "Brancas"} vencem.`);
      } else {
        this.result = "draw";
        this.resultReason = "Stalemate";
        this.pushLog("Empate por afogamento");
      }
      this.phase = "ended";
      return { ok: true, gameEnded: true };
    }
    if (isInCheck(this.board, this.turn)) {
      this.pushLog(`Xeque em ${this.turn === "w" ? "brancas" : "pretas"}`);
    }
    return { ok: true, gameEnded: false };
  }

  // Para o cliente: lista quadrados destino legais para uma peca
  legalDestinationsFrom(from: ChessSquare, byPlayer: string): ChessSquare[] {
    if (this.phase !== "playing") return [];
    const seat = this.seats[this.turn];
    if (seat.playerId !== byPlayer) return [];
    const piece = pieceAt(this.board, from);
    if (!piece || piece.color !== this.turn) return [];
    const legal = generateLegalMoves(this.board, this.turn);
    return legal
      .filter((m) => m.from.file === from.file && m.from.rank === from.rank)
      .map((m) => m.to);
  }
}
