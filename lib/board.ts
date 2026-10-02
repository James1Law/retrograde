import type { Action, Board, BoardView, Card, Column, StorageKind } from "./types";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function shortId(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const LIMITS = {
  boardName: 80,
  columnTitle: 40,
  columns: 6,
  participantName: 40,
  cardText: 500,
};

export const DEFAULT_COLUMNS = ["Went well", "Didn't go well", "Ideas"];

export function createBoard(name: string, columnTitles: string[], now = Date.now()): Board {
  const columns: Column[] = columnTitles.map((title) => ({
    id: shortId(6),
    title: title.trim().slice(0, LIMITS.columnTitle),
  }));
  return {
    id: shortId(8),
    name: name.trim().slice(0, LIMITS.boardName),
    hostToken: shortId(24),
    columns,
    participants: {},
    cards: {},
    spotlightId: null,
    createdAt: now,
    version: 1,
  };
}

export type ActionContext = { participantId: string; isHost: boolean };
export type ActionResult =
  | { ok: true; board: Board }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): ActionResult => ({ ok: false, status, error });

/** Pure: returns a new board (version + 1) or an error. Never mutates the input. */
export function applyAction(
  board: Board,
  action: Action,
  ctx: ActionContext,
  now = Date.now(),
): ActionResult {
  const { participantId, isHost } = ctx;
  if (!participantId) return fail(400, "Missing participant id");

  const next: Board = {
    ...board,
    participants: { ...board.participants },
    cards: { ...board.cards },
    version: board.version + 1,
  };

  if (action.type === "join") {
    const name = (action.name ?? "").trim().slice(0, LIMITS.participantName);
    if (!name) return fail(400, "Please enter your name");
    const existing = next.participants[participantId];
    next.participants[participantId] = {
      id: participantId,
      name,
      joinedAt: existing?.joinedAt ?? now,
      isHost: isHost || existing?.isHost === true,
    };
    return { ok: true, board: next };
  }

  if (!next.participants[participantId]) return fail(403, "Join the retro first");

  switch (action.type) {
    case "addCard": {
      const text = (action.text ?? "").trim().slice(0, LIMITS.cardText);
      if (!text) return fail(400, "Write something on the card first");
      if (!next.columns.some((c) => c.id === action.columnId)) return fail(400, "Unknown column");
      const card: Card = {
        id: shortId(10),
        columnId: action.columnId,
        authorId: participantId,
        text,
        revealed: false,
        createdAt: now,
      };
      next.cards[card.id] = card;
      return { ok: true, board: next };
    }
    case "editCard": {
      const card = next.cards[action.cardId];
      if (!card) return fail(404, "That card no longer exists");
      if (card.authorId !== participantId) return fail(403, "You can only edit your own cards");
      const text = (action.text ?? "").trim().slice(0, LIMITS.cardText);
      if (!text) return fail(400, "A card can't be empty");
      next.cards[card.id] = { ...card, text };
      return { ok: true, board: next };
    }
    case "deleteCard": {
      const card = next.cards[action.cardId];
      if (!card) return { ok: true, board: next };
      if (card.authorId !== participantId && !isHost) return fail(403, "You can only delete your own cards");
      delete next.cards[card.id];
      return { ok: true, board: next };
    }
    case "setRevealed": {
      const card = next.cards[action.cardId];
      if (!card) return fail(404, "That card no longer exists");
      if (card.authorId !== participantId && !isHost) {
        return fail(403, "Only the author or the host can reveal a card");
      }
      next.cards[card.id] = { ...card, revealed: Boolean(action.revealed) };
      return { ok: true, board: next };
    }
    case "revealAllMine": {
      for (const card of Object.values(next.cards)) {
        if (card.authorId === participantId && !card.revealed) {
          next.cards[card.id] = { ...card, revealed: true };
        }
      }
      return { ok: true, board: next };
    }
    case "setSpotlight": {
      if (!isHost) return fail(403, "Only the host can control the spotlight");
      if (action.participantId !== null && !next.participants[action.participantId]) {
        return fail(400, "Unknown participant");
      }
      next.spotlightId = action.participantId;
      return { ok: true, board: next };
    }
    default:
      return fail(400, "Unknown action");
  }
}

/** What one viewer is allowed to see. Hidden cards keep their author but lose their text. */
export function toView(board: Board, viewerId: string, isHost: boolean, storage: StorageKind): BoardView {
  const participants = Object.values(board.participants).sort((a, b) => a.joinedAt - b.joinedAt);
  const cards = Object.values(board.cards)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({ ...c, text: c.revealed || c.authorId === viewerId ? c.text : null }));
  return {
    id: board.id,
    name: board.name,
    columns: board.columns,
    participants,
    cards,
    spotlightId: board.spotlightId,
    version: board.version,
    isHost,
    storage,
  };
}
