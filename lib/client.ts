import type { Action, BoardView } from "./types";

export type Identity = { id: string; name: string };
export type Unchanged = { unchanged: true; version: number };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const storageKey = (boardId: string, suffix: string) => `retro:${boardId}:${suffix}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or blocked storage: the session still works, it just won't survive a refresh.
  }
}

export const loadIdentity = (boardId: string) => read<Identity>(storageKey(boardId, "me"));
export const saveIdentity = (boardId: string, identity: Identity) =>
  write(storageKey(boardId, "me"), identity);
export const loadHostToken = (boardId: string) => read<string>(storageKey(boardId, "host"));
export const saveHostToken = (boardId: string, token: string) =>
  write(storageKey(boardId, "host"), token);

export function newParticipantId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function headers(identity: Identity | null, hostToken: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (identity) h["x-participant-id"] = identity.id;
  if (hostToken) h["x-host-token"] = hostToken;
  return h;
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function createBoard(
  name: string,
  columns: string[],
): Promise<{ id: string; hostToken: string }> {
  const res = await fetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, columns }),
  });
  return parse(res);
}

export async function fetchBoard(
  boardId: string,
  identity: Identity | null,
  hostToken: string | null,
  since?: number,
): Promise<BoardView | Unchanged> {
  const qs = since !== undefined ? `?since=${since}` : "";
  const res = await fetch(`/api/boards/${boardId}${qs}`, {
    headers: headers(identity, hostToken),
    cache: "no-store",
  });
  return parse(res);
}

export async function sendAction(
  boardId: string,
  identity: Identity,
  hostToken: string | null,
  action: Action,
): Promise<BoardView> {
  const res = await fetch(`/api/boards/${boardId}/action`, {
    method: "POST",
    headers: headers(identity, hostToken),
    body: JSON.stringify({ action }),
  });
  return parse(res);
}
