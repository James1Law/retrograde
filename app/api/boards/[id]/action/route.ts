import { NextRequest, NextResponse } from "next/server";
import { applyAction, toView } from "@/lib/board";
import { getStore } from "@/lib/store";
import type { Action } from "@/lib/types";

export const runtime = "nodejs";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

const PARTICIPANT_ID = /^[A-Za-z0-9-]{1,64}$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: Action } | null;
  const action = body?.action;
  if (!action || typeof action.type !== "string") return json({ error: "Bad request" }, 400);

  const participantId = req.headers.get("x-participant-id") ?? "";
  if (!PARTICIPANT_ID.test(participantId)) return json({ error: "Missing participant id" }, 400);
  const hostToken = req.headers.get("x-host-token") ?? "";

  const store = getStore();
  // Optimistic concurrency: re-read and retry if someone else wrote in between.
  for (let attempt = 0; attempt < 6; attempt++) {
    const board = await store.get(id);
    if (!board) return json({ error: "This retro doesn't exist" }, 404);
    const isHost = hostToken.length > 0 && hostToken === board.hostToken;
    const result = applyAction(board, action, { participantId, isHost });
    if (!result.ok) return json({ error: result.error }, result.status);
    if (await store.cas(result.board, board.version)) {
      return json(toView(result.board, participantId, isHost, store.kind));
    }
  }
  return json({ error: "The board is busy, please try again" }, 409);
}
