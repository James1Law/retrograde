import { Redis } from "@upstash/redis";
import type { Board, StorageKind } from "./types";

export interface Store {
  readonly kind: StorageKind;
  get(id: string): Promise<Board | null>;
  create(board: Board): Promise<void>;
  /** Write `board` only if the stored version still equals `expectedVersion`. */
  cas(board: Board, expectedVersion: number): Promise<boolean>;
}

const TTL_SECONDS = 60 * 60 * 24 * 30; // boards are kept for 30 days

/** Used locally when no Redis credentials are present. Lives only in this process. */
class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private boards = new Map<string, Board>();

  async get(id: string) {
    return this.boards.get(id) ?? null;
  }
  async create(board: Board) {
    this.boards.set(board.id, board);
  }
  async cas(board: Board, expectedVersion: number) {
    const current = this.boards.get(board.id);
    if (!current || current.version !== expectedVersion) return false;
    this.boards.set(board.id, board);
    return true;
  }
}

const boardKey = (id: string) => `retro:board:${id}`;
const versionKey = (id: string) => `retro:board:${id}:v`;

// KEYS[1] = board json, KEYS[2] = version counter
// ARGV[1] = expected version, ARGV[2] = new json, ARGV[3] = ttl seconds, ARGV[4] = new version
const CAS_SCRIPT = `
local v = redis.call('GET', KEYS[2])
if v ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'EX', ARGV[3])
return 1
`;

class RedisStore implements Store {
  readonly kind = "redis" as const;
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token, automaticDeserialization: false });
  }
  async get(id: string) {
    const raw = await this.redis.get<string>(boardKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as Board;
  }
  async create(board: Board) {
    const p = this.redis.pipeline();
    p.set(boardKey(board.id), JSON.stringify(board), { ex: TTL_SECONDS });
    p.set(versionKey(board.id), String(board.version), { ex: TTL_SECONDS });
    await p.exec();
  }
  async cas(board: Board, expectedVersion: number) {
    const result = await this.redis.eval(
      CAS_SCRIPT,
      [boardKey(board.id), versionKey(board.id)],
      [String(expectedVersion), JSON.stringify(board), String(TTL_SECONDS), String(board.version)],
    );
    return Number(result) === 1;
  }
}

function makeStore(): Store {
  // Vercel's Upstash add-on injects either naming scheme depending on when it was created.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisStore(url, token);
  return new MemoryStore();
}

// One store per process so the in-memory version survives hot reloads in dev.
const globalForStore = globalThis as unknown as { __retroStore?: Store };

export function getStore(): Store {
  if (!globalForStore.__retroStore) globalForStore.__retroStore = makeStore();
  return globalForStore.__retroStore;
}
