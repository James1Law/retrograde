import { NextRequest, NextResponse } from "next/server";
import { toView } from "@/lib/board";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const board = await store.get(id);
  if (!board) return json({ error: "This retro doesn't exist" }, 404);

  const sinceParam = req.nextUrl.searchParams.get("since");
  if (sinceParam !== null && Number(sinceParam) === board.version) {
    return json({ unchanged: true, version: board.version });
  }

  const participantId = req.headers.get("x-participant-id") ?? "";
  const hostToken = req.headers.get("x-host-token") ?? "";
  const isHost = hostToken.length > 0 && hostToken === board.hostToken;
  return json(toView(board, participantId, isHost, store.kind));
}
