"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBoard } from "@/lib/client";
import { DEFAULT_COLUMNS, LIMITS } from "@/lib/board";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validColumns = columns.map((c) => c.trim()).filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id, hostToken } = await createBoard(name.trim() || "Sprint retro", validColumns);
      router.push(`/b/${id}?host=${hostToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Retro</p>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">Start a retro</h1>
          <p className="mt-2 text-stone-600">
            Create the board, then share one link with the team. Everyone adds cards, reveals them
            when ready, and you run the spotlight.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-lg">
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Retro name
          </label>
          <input
            id="name"
            autoFocus
            maxLength={LIMITS.boardName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 42 retro"
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />

          <div className="mt-5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-stone-700">Columns</span>
            <span className="text-xs text-stone-500">Rename or add up to {LIMITS.columns}</span>
          </div>
          <ul className="mt-1 space-y-2">
            {columns.map((col, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Column ${i + 1} title`}
                  maxLength={LIMITS.columnTitle}
                  value={col}
                  onChange={(e) =>
                    setColumns(columns.map((c, j) => (j === i ? e.target.value : c)))
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="button"
                  aria-label={`Remove column ${i + 1}`}
                  disabled={columns.length <= 1}
                  onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                  className="rounded-lg px-2 py-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {columns.length < LIMITS.columns && (
            <button
              type="button"
              onClick={() => setColumns([...columns, ""])}
              className="mt-2 text-sm font-medium text-amber-700 hover:underline"
            >
              + Add a column
            </button>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy || validColumns.length === 0}
            className="mt-6 w-full rounded-lg bg-stone-900 px-4 py-3 text-base font-semibold text-white hover:bg-stone-700 disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create the board"}
          </button>
        </form>

        <ol className="mt-6 space-y-1 text-sm text-stone-600">
          <li>1. You become the host and enter your name.</li>
          <li>2. Copy the invite link from the board and share it with the team.</li>
          <li>3. Everyone writes cards. They stay hidden until the author reveals them.</li>
          <li>4. Use the spotlight to go round the room one person at a time.</li>
        </ol>
      </div>
    </main>
  );
}
