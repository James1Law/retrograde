import { NextResponse } from "next/server";
import { createBoard, LIMITS } from "@/lib/board";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: unknown; columns?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const columns = Array.isArray(body?.columns)
    ? body.columns
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, LIMITS.columns)
    : [];

  if (!name) return NextResponse.json({ error: "Give the retro a name" }, { status: 400 });
  if (columns.length === 0) {
    return NextResponse.json({ error: "Add at least one column" }, { status: 400 });
  }

  const board = createBoard(name, columns);
  await getStore().create(board);
  return NextResponse.json({ id: board.id, hostToken: board.hostToken });
}
