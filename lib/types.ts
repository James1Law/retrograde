export type Column = { id: string; title: string };

export type Participant = {
  id: string;
  name: string;
  joinedAt: number;
  isHost: boolean;
};

export type Card = {
  id: string;
  columnId: string;
  authorId: string;
  text: string;
  revealed: boolean;
  createdAt: number;
};

/** The full board as stored. Never sent to clients as-is (contains hostToken, hidden text). */
export type Board = {
  id: string;
  name: string;
  hostToken: string;
  columns: Column[];
  participants: Record<string, Participant>;
  cards: Record<string, Card>;
  spotlightId: string | null;
  createdAt: number;
  version: number;
};

/** A card as one viewer sees it. `text` is null when it is hidden from them. */
export type CardView = Omit<Card, "text"> & { text: string | null };

export type StorageKind = "memory" | "redis";

export type BoardView = {
  id: string;
  name: string;
  columns: Column[];
  participants: Participant[];
  cards: CardView[];
  spotlightId: string | null;
  version: number;
  isHost: boolean;
  storage: StorageKind;
};

export type Action =
  | { type: "join"; name: string }
  | { type: "addCard"; columnId: string; text: string }
  | { type: "editCard"; cardId: string; text: string }
  | { type: "deleteCard"; cardId: string }
  | { type: "setRevealed"; cardId: string; revealed: boolean }
  | { type: "revealAllMine" }
  | { type: "setSpotlight"; participantId: string | null };
