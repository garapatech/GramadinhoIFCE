// Texas Hold'em engine. Estado mantido em memoria pela PartyKit room.
// 6 lugares fixos. Side pots calculados no showdown via niveis de aposta.

export type Suit = "S" | "H" | "D" | "C";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type Card = { rank: Rank; suit: Suit };

export type Phase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export type SeatPublic = {
  index: number;
  playerId: string | null;
  nick: string;
  chips: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  betThisRound: number;
  totalBetInHand: number;
  hasActedThisRound: boolean;
  showCards: Card[] | null;
};

export type WinnerSummary = {
  seatIndex: number;
  nick: string;
  amount: number;
  handName: string;
  cards: Card[];
};

export type PokerPublicState = {
  phase: Phase;
  seats: SeatPublic[];
  pot: number;
  community: Card[];
  currentBet: number;
  minRaise: number;
  toActIndex: number | null;
  dealerIndex: number | null;
  smallBlindIndex: number | null;
  bigBlindIndex: number | null;
  smallBlind: number;
  bigBlind: number;
  lastWinners: WinnerSummary[];
  log: string[];
};

export type PokerActionKind = "fold" | "check" | "call" | "raise" | "allin";

export type ActionResult =
  | { ok: true; handEnded: boolean }
  | { ok: false; error: string };

type SeatInternal = SeatPublic & {
  holeCards: Card[];
};

const SUITS: Suit[] = ["S", "H", "D", "C"];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  return deck;
}

// Fisher-Yates
export function shuffleDeck(deck: Card[]): Card[] {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const HAND_NAMES = [
  "Carta alta",
  "Par",
  "Dois pares",
  "Trinca",
  "Sequencia",
  "Flush",
  "Full house",
  "Quadra",
  "Straight flush",
];

// Avalia uma mao de 5 cartas: retorna [categoria, k1,k2,k3,k4,k5]
// Categoria: 0=carta alta ... 8=straight flush. Quanto maior, melhor.
function rankFive(cards: Card[]): number[] {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const counts = new Map<Rank, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // arrays de cartas agrupadas por contagem (desc por contagem, depois por rank)
  const grouped = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const groupCounts = grouped.map((g) => g[1]).join(",");
  const groupRanks = grouped.map((g) => g[0]);

  const isFlush = suits.every((s) => s === suits[0]);

  // Sequencia: ranks unicos, todos consecutivos. Ace pode ser low (A-2-3-4-5)
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh: number | null = null;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0];
    // wheel: A,5,4,3,2
    else if (
      unique[0] === 14 && unique[1] === 5 && unique[2] === 4 &&
      unique[3] === 3 && unique[4] === 2
    ) straightHigh = 5;
  }

  if (straightHigh !== null && isFlush) return [8, straightHigh, 0, 0, 0, 0];
  if (groupCounts === "4,1") return [7, groupRanks[0], groupRanks[1], 0, 0, 0];
  if (groupCounts === "3,2") return [6, groupRanks[0], groupRanks[1], 0, 0, 0];
  if (isFlush) return [5, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]];
  if (straightHigh !== null) return [4, straightHigh, 0, 0, 0, 0];
  if (groupCounts === "3,1,1") return [3, groupRanks[0], groupRanks[1], groupRanks[2], 0, 0];
  if (groupCounts === "2,2,1") return [2, groupRanks[0], groupRanks[1], groupRanks[2], 0, 0];
  if (groupCounts === "2,1,1,1")
    return [1, groupRanks[0], groupRanks[1], groupRanks[2], groupRanks[3], 0];
  return [0, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]];
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Melhor 5 dentre 7 (hole + community)
function bestFiveOfSeven(seven: Card[]): { score: number[]; cards: Card[] } {
  let best: { score: number[]; cards: Card[] } | null = null;
  for (let i = 0; i < seven.length; i++) {
    for (let j = i + 1; j < seven.length; j++) {
      const five: Card[] = [];
      for (let k = 0; k < seven.length; k++) if (k !== i && k !== j) five.push(seven[k]);
      const score = rankFive(five);
      if (!best || compareRank(score, best.score) > 0) {
        best = { score, cards: five };
      }
    }
  }
  return best!;
}

export class PokerTable {
  readonly seatCount: number;
  seats: SeatInternal[];
  deck: Card[] = [];
  pot = 0;
  community: Card[] = [];
  phase: Phase = "waiting";
  dealerIndex = -1;
  smallBlindIndex: number | null = null;
  bigBlindIndex: number | null = null;
  currentBet = 0;
  minRaise = 0;
  toActIndex: number | null = null;
  smallBlind = 5;
  bigBlind = 10;
  startingChips = 500;
  lastWinners: WinnerSummary[] = [];
  log: string[] = [];
  // Quando a mao acaba via fold geral ou showdown, marcamos aqui pra um
  // delay antes da proxima mao comecar (handled pela room via tick).
  nextHandAt: number | null = null;

  constructor(seatCount = 6) {
    this.seatCount = seatCount;
    this.seats = Array.from({ length: seatCount }, (_, i) => ({
      index: i,
      playerId: null,
      nick: "",
      chips: 0,
      inHand: false,
      folded: false,
      allIn: false,
      betThisRound: 0,
      totalBetInHand: 0,
      hasActedThisRound: false,
      holeCards: [],
      showCards: null,
    }));
  }

  private pushLog(text: string) {
    this.log.push(text);
    if (this.log.length > 40) this.log.splice(0, this.log.length - 40);
  }

  sit(seatIndex: number, playerId: string, nick: string): { ok: boolean; error?: string } {
    if (seatIndex < 0 || seatIndex >= this.seatCount) {
      return { ok: false, error: "Assento invalido" };
    }
    const seat = this.seats[seatIndex];
    if (seat.playerId === playerId) return { ok: true };
    if (seat.playerId) return { ok: false, error: "Assento ocupado" };
    if (this.seats.some((s) => s.playerId === playerId)) {
      return { ok: false, error: "Voce ja esta sentado" };
    }
    seat.playerId = playerId;
    seat.nick = nick;
    seat.chips = this.startingChips;
    seat.inHand = false;
    seat.folded = false;
    seat.allIn = false;
    seat.betThisRound = 0;
    seat.totalBetInHand = 0;
    seat.hasActedThisRound = false;
    seat.holeCards = [];
    seat.showCards = null;
    this.pushLog(`${nick} sentou no assento ${seatIndex + 1}`);
    return { ok: true };
  }

  stand(playerId: string): boolean {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) return false;
    const nick = seat.nick;
    const seatIdx = seat.index;
    const wasInHand = seat.inHand && !seat.folded;
    // Limpa o jogador
    seat.playerId = null;
    seat.nick = "";
    seat.chips = 0;
    seat.inHand = false;
    seat.folded = false;
    seat.allIn = false;
    seat.betThisRound = 0;
    seat.totalBetInHand = 0;
    seat.hasActedThisRound = false;
    seat.holeCards = [];
    seat.showCards = null;
    this.pushLog(`${nick} saiu do assento ${seatIdx + 1}`);
    if (wasInHand) {
      // Trata como fold no meio da mao
      this.handleSeatLeftMidHand(seatIdx);
    }
    if (this.activeSeats().length < 2 && this.phase !== "waiting") {
      this.phase = "waiting";
      this.toActIndex = null;
    }
    return true;
  }

  getHoleCards(playerId: string): Card[] | null {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.holeCards.length === 0) return null;
    return seat.holeCards.slice();
  }

  publicState(): PokerPublicState {
    return {
      phase: this.phase,
      seats: this.seats.map((s) => ({
        index: s.index,
        playerId: s.playerId,
        nick: s.nick,
        chips: s.chips,
        inHand: s.inHand,
        folded: s.folded,
        allIn: s.allIn,
        betThisRound: s.betThisRound,
        totalBetInHand: s.totalBetInHand,
        hasActedThisRound: s.hasActedThisRound,
        showCards: s.showCards,
      })),
      pot: this.pot,
      community: this.community.slice(),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      toActIndex: this.toActIndex,
      dealerIndex: this.dealerIndex < 0 ? null : this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      lastWinners: this.lastWinners.slice(),
      log: this.log.slice(),
    };
  }

  private activeSeats(): SeatInternal[] {
    return this.seats.filter((s) => s.playerId !== null && s.chips > 0);
  }

  private seatsInHand(): SeatInternal[] {
    return this.seats.filter((s) => s.inHand && !s.folded);
  }

  private nextSeatInHand(from: number): number | null {
    for (let step = 1; step <= this.seatCount; step++) {
      const idx = (from + step) % this.seatCount;
      const s = this.seats[idx];
      if (s.inHand && !s.folded && !s.allIn) return idx;
    }
    return null;
  }

  private nextOccupiedSeat(from: number): number | null {
    for (let step = 1; step <= this.seatCount; step++) {
      const idx = (from + step) % this.seatCount;
      if (this.seats[idx].playerId !== null && this.seats[idx].chips > 0) return idx;
    }
    return null;
  }

  // Pode iniciar nova mao quando >=2 sentados com fichas e fase waiting
  canStartHand(): boolean {
    return this.phase === "waiting" && this.activeSeats().length >= 2;
  }

  tryStartHand(): boolean {
    if (!this.canStartHand()) return false;
    // Reseta estado de mao anterior
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.lastWinners = [];
    this.nextHandAt = null;
    for (const s of this.seats) {
      s.folded = false;
      s.allIn = false;
      s.betThisRound = 0;
      s.totalBetInHand = 0;
      s.hasActedThisRound = false;
      s.holeCards = [];
      s.showCards = null;
      s.inHand = s.playerId !== null && s.chips > 0;
    }
    // Move dealer button
    const occupied = this.seats.filter((s) => s.inHand);
    if (occupied.length < 2) {
      this.phase = "waiting";
      return false;
    }
    if (this.dealerIndex < 0) {
      this.dealerIndex = occupied[0].index;
    } else {
      const next = this.nextOccupiedSeat(this.dealerIndex);
      if (next === null) {
        this.phase = "waiting";
        return false;
      }
      this.dealerIndex = next;
    }
    // Small blind = next seat after dealer (heads-up: SB = dealer)
    if (occupied.length === 2) {
      this.smallBlindIndex = this.dealerIndex;
      this.bigBlindIndex = this.nextOccupiedSeat(this.dealerIndex)!;
    } else {
      this.smallBlindIndex = this.nextOccupiedSeat(this.dealerIndex)!;
      this.bigBlindIndex = this.nextOccupiedSeat(this.smallBlindIndex)!;
    }
    this.postBlind(this.smallBlindIndex!, this.smallBlind);
    this.postBlind(this.bigBlindIndex!, this.bigBlind);
    this.currentBet = this.bigBlind;
    // Embaralhar e distribuir
    this.deck = shuffleDeck(freshDeck());
    // Dois cartoes para cada (estilo casino: 1 carta por vez ao redor)
    for (let pass = 0; pass < 2; pass++) {
      let cursor = this.dealerIndex;
      for (let k = 0; k < occupied.length; k++) {
        const next = this.nextOccupiedSeat(cursor);
        if (next === null) break;
        cursor = next;
        const seat = this.seats[next];
        const card = this.deck.pop()!;
        seat.holeCards.push(card);
      }
    }
    this.phase = "preflop";
    // Acao comeca a esquerda do BB
    this.toActIndex = this.nextSeatInHand(this.bigBlindIndex!);
    // Em heads-up preflop, SB age primeiro
    if (occupied.length === 2) this.toActIndex = this.smallBlindIndex;
    this.pushLog(`Nova mao: dealer ${this.seats[this.dealerIndex].nick}`);
    return true;
  }

  private postBlind(seatIndex: number, amount: number) {
    const seat = this.seats[seatIndex];
    const pay = Math.min(seat.chips, amount);
    seat.chips -= pay;
    seat.betThisRound += pay;
    seat.totalBetInHand += pay;
    this.pot += pay;
    if (seat.chips === 0) seat.allIn = true;
    this.pushLog(
      `${seat.nick} pagou ${amount === this.smallBlind ? "small" : "big"} blind (${pay})`,
    );
  }

  private handleSeatLeftMidHand(seatIndex: number) {
    const seat = this.seats[seatIndex];
    seat.folded = true;
    seat.inHand = false;
    if (this.toActIndex === seatIndex) {
      this.advanceActor();
    }
    this.checkOnePlayerLeft();
  }

  private checkOnePlayerLeft(): boolean {
    const remaining = this.seatsInHand();
    if (remaining.length === 1) {
      // Ganhador unico leva o pote inteiro
      const winner = remaining[0];
      winner.chips += this.pot;
      this.lastWinners = [{
        seatIndex: winner.index,
        nick: winner.nick,
        amount: this.pot,
        handName: "Todos foldaram",
        cards: [],
      }];
      this.pushLog(`${winner.nick} levou ${this.pot} (todos foldaram)`);
      this.pot = 0;
      this.finishHand();
      return true;
    }
    return false;
  }

  action(playerId: string, kind: PokerActionKind, raiseAmount?: number): ActionResult {
    if (this.phase === "waiting" || this.phase === "showdown") {
      return { ok: false, error: "Sem mao em andamento" };
    }
    if (this.toActIndex === null) return { ok: false, error: "Sem atuante" };
    const seat = this.seats[this.toActIndex];
    if (seat.playerId !== playerId) return { ok: false, error: "Nao e sua vez" };
    if (!seat.inHand || seat.folded || seat.allIn) {
      return { ok: false, error: "Voce nao esta na acao" };
    }

    const toCall = this.currentBet - seat.betThisRound;

    if (kind === "fold") {
      seat.folded = true;
      seat.hasActedThisRound = true;
      this.pushLog(`${seat.nick} foldou`);
      if (this.checkOnePlayerLeft()) return { ok: true, handEnded: true };
      this.advanceActor();
      this.maybeAdvancePhase();
      return { ok: true, handEnded: (this.phase as Phase) === "waiting" };
    }

    if (kind === "check") {
      if (toCall > 0) return { ok: false, error: "Tem aposta pra pagar" };
      seat.hasActedThisRound = true;
      this.pushLog(`${seat.nick} mesa`);
      this.advanceActor();
      this.maybeAdvancePhase();
      return { ok: true, handEnded: (this.phase as Phase) === "waiting" };
    }

    if (kind === "call") {
      if (toCall <= 0) return { ok: false, error: "Nada para pagar (use mesa)" };
      const pay = Math.min(seat.chips, toCall);
      seat.chips -= pay;
      seat.betThisRound += pay;
      seat.totalBetInHand += pay;
      this.pot += pay;
      if (seat.chips === 0) seat.allIn = true;
      seat.hasActedThisRound = true;
      this.pushLog(`${seat.nick} pagou ${pay}${seat.allIn ? " (all-in)" : ""}`);
      this.advanceActor();
      this.maybeAdvancePhase();
      return { ok: true, handEnded: (this.phase as Phase) === "waiting" };
    }

    if (kind === "raise") {
      if (!raiseAmount || raiseAmount <= 0) return { ok: false, error: "Valor invalido" };
      // raiseAmount eh o tamanho TOTAL da aposta (nao o incremento)
      const total = Math.floor(raiseAmount);
      if (total < this.currentBet + this.minRaise) {
        return { ok: false, error: `Aumento minimo: ${this.currentBet + this.minRaise}` };
      }
      const need = total - seat.betThisRound;
      if (need > seat.chips) {
        return { ok: false, error: "Fichas insuficientes (use all-in)" };
      }
      seat.chips -= need;
      seat.betThisRound += need;
      seat.totalBetInHand += need;
      this.pot += need;
      const increment = total - this.currentBet;
      this.minRaise = Math.max(this.minRaise, increment);
      this.currentBet = total;
      seat.hasActedThisRound = true;
      // Outros jogadores em jogo precisam responder de novo
      for (const s of this.seatsInHand()) {
        if (s.index !== seat.index && !s.allIn) s.hasActedThisRound = false;
      }
      if (seat.chips === 0) seat.allIn = true;
      this.pushLog(`${seat.nick} aumentou para ${total}${seat.allIn ? " (all-in)" : ""}`);
      this.advanceActor();
      this.maybeAdvancePhase();
      return { ok: true, handEnded: (this.phase as Phase) === "waiting" };
    }

    if (kind === "allin") {
      const total = seat.betThisRound + seat.chips;
      const need = seat.chips;
      seat.chips = 0;
      seat.betThisRound += need;
      seat.totalBetInHand += need;
      this.pot += need;
      seat.allIn = true;
      seat.hasActedThisRound = true;
      if (total > this.currentBet) {
        const increment = total - this.currentBet;
        // All-in pode ser menor que minRaise; nesse caso nao re-abre round,
        // mas ainda aumenta currentBet pra quem ainda nao apostou tanto.
        if (increment >= this.minRaise) {
          this.minRaise = increment;
          for (const s of this.seatsInHand()) {
            if (s.index !== seat.index && !s.allIn) s.hasActedThisRound = false;
          }
        }
        this.currentBet = total;
      }
      this.pushLog(`${seat.nick} foi all-in (${need})`);
      this.advanceActor();
      this.maybeAdvancePhase();
      return { ok: true, handEnded: (this.phase as Phase) === "waiting" };
    }

    return { ok: false, error: "Acao desconhecida" };
  }

  private advanceActor() {
    if (this.toActIndex === null) return;
    const next = this.nextSeatInHand(this.toActIndex);
    this.toActIndex = next;
  }

  // Verifica se round terminou (todos no mesmo bet e ja atuaram)
  private isBettingRoundOver(): boolean {
    const inHand = this.seatsInHand();
    if (inHand.length <= 1) return true;
    const active = inHand.filter((s) => !s.allIn);
    if (active.length === 0) return true;
    for (const s of active) {
      if (!s.hasActedThisRound) return false;
      if (s.betThisRound !== this.currentBet) return false;
    }
    return true;
  }

  private maybeAdvancePhase() {
    if (!this.isBettingRoundOver()) return;
    // Reset betThisRound/hasActed
    for (const s of this.seats) {
      s.betThisRound = 0;
      s.hasActedThisRound = false;
    }
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    // Se restam menos de 2 nao-allin com cards, queima ate o river e showdown
    const playersWhoCanAct = this.seatsInHand().filter((s) => !s.allIn);
    const skipBetting = playersWhoCanAct.length < 2;

    if (this.phase === "preflop") {
      this.dealFlop();
      this.phase = "flop";
    } else if (this.phase === "flop") {
      this.dealTurn();
      this.phase = "turn";
    } else if (this.phase === "turn") {
      this.dealRiver();
      this.phase = "river";
    } else if (this.phase === "river") {
      this.doShowdown();
      return;
    }

    if (skipBetting && this.phase !== "showdown") {
      // Continua queimando ate showdown
      this.maybeAdvancePhase();
      return;
    }

    // Define toActIndex para esta nova rodada (primeiro inHand a esquerda do dealer)
    const dealer = this.dealerIndex;
    const first = this.nextSeatInHand(dealer);
    this.toActIndex = first;
  }

  private dealFlop() {
    this.deck.pop(); // burn
    this.community.push(this.deck.pop()!);
    this.community.push(this.deck.pop()!);
    this.community.push(this.deck.pop()!);
    this.pushLog("Flop");
  }
  private dealTurn() {
    this.deck.pop();
    this.community.push(this.deck.pop()!);
    this.pushLog("Turn");
  }
  private dealRiver() {
    this.deck.pop();
    this.community.push(this.deck.pop()!);
    this.pushLog("River");
  }

  private doShowdown() {
    this.phase = "showdown";
    this.toActIndex = null;
    const contenders = this.seatsInHand();
    // Calcula side pots usando totalBetInHand
    const allBets = this.seats
      .map((s) => s.totalBetInHand)
      .filter((b) => b > 0);
    const levels = [...new Set(allBets)].sort((a, b) => a - b);
    type Pot = { amount: number; eligible: number[] };
    const pots: Pot[] = [];
    let prev = 0;
    for (const lvl of levels) {
      let amount = 0;
      const eligible: number[] = [];
      for (const s of this.seats) {
        const contribution = Math.min(s.totalBetInHand, lvl) - Math.min(s.totalBetInHand, prev);
        amount += contribution;
        if (s.totalBetInHand >= lvl && contenders.includes(s)) eligible.push(s.index);
      }
      if (amount > 0 && eligible.length > 0) pots.push({ amount, eligible });
      prev = lvl;
    }

    // Avalia cada contendor
    const scores = new Map<number, { score: number[]; cards: Card[] }>();
    for (const s of contenders) {
      const seven = [...s.holeCards, ...this.community];
      const best = bestFiveOfSeven(seven);
      scores.set(s.index, best);
      s.showCards = s.holeCards.slice();
    }

    const winners: WinnerSummary[] = [];
    for (const pot of pots) {
      const eligibleContenders = pot.eligible.filter((idx) => scores.has(idx));
      if (eligibleContenders.length === 0) continue;
      // Encontra melhor score entre eligible
      let bestIdx: number[] = [];
      let bestScore: number[] | null = null;
      for (const idx of eligibleContenders) {
        const sc = scores.get(idx)!.score;
        if (!bestScore || compareRank(sc, bestScore) > 0) {
          bestScore = sc;
          bestIdx = [idx];
        } else if (compareRank(sc, bestScore) === 0) {
          bestIdx.push(idx);
        }
      }
      const share = Math.floor(pot.amount / bestIdx.length);
      const remainder = pot.amount - share * bestIdx.length;
      for (let i = 0; i < bestIdx.length; i++) {
        const idx = bestIdx[i];
        const seat = this.seats[idx];
        const amt = share + (i < remainder ? 1 : 0);
        seat.chips += amt;
        const handName = HAND_NAMES[bestScore![0]];
        winners.push({
          seatIndex: idx,
          nick: seat.nick,
          amount: amt,
          handName,
          cards: scores.get(idx)!.cards,
        });
        this.pushLog(`${seat.nick} ganhou ${amt} com ${handName}`);
      }
    }
    this.lastWinners = winners;
    this.pot = 0;
    this.finishHand();
  }

  private finishHand() {
    // Limpa estado mas mantem cards em show ate proxima mao comecar
    for (const s of this.seats) {
      s.inHand = false;
      s.betThisRound = 0;
      s.totalBetInHand = 0;
      s.hasActedThisRound = false;
      s.allIn = false;
      // holeCards: limpamos so quando iniciar proxima mao
    }
    this.phase = "waiting";
    this.toActIndex = null;
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    // Agendar proxima mao para daqui a alguns segundos (room decide tick)
    this.nextHandAt = Date.now() + 6000;
  }
}

export function cardLabel(card: Card): string {
  const rankLabel =
    card.rank === 14 ? "A" :
    card.rank === 13 ? "K" :
    card.rank === 12 ? "Q" :
    card.rank === 11 ? "J" :
    String(card.rank);
  return `${rankLabel}${card.suit}`;
}
