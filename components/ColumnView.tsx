"use client";

import { useState } from "react";
import type { CardView, Column } from "@/lib/types";
import { RetroCard } from "./RetroCard";

type Props = {
  column: Column;
  index: number;
  cards: CardView[];
  names: Record<string, string>;
  meId: string;
  isHost: boolean;
  spotlightId: string | null;
  onAdd: (text: string) => Promise<void>;
  onReveal: (cardId: string, revealed: boolean) => void;
  onEdit: (cardId: string, text: string) => void;
  onDelete: (cardId: string) => void;
};

export function ColumnView({
  column,
  index,
  cards,
  names,
  meId,
  isHost,
  spotlightId,
  onAdd,
  onReveal,
  onEdit,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const spot = spotlightId !== null;

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onAdd(text);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`flex flex-col rounded-2xl lg:min-h-[50vh] p-3 transition-colors duration-700 ${
        spot ? "bg-white/5" : "bg-white/70"
      }`}
    >
      <header className="flex items-baseline justify-between px-1">
        <h2 className={`text-base font-semibold ${spot ? "text-white" : "text-stone-800"}`}>
          {column.title}
        </h2>
        <span className={`text-xs ${spot ? "text-stone-400" : "text-stone-500"}`}>
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </span>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3"
      >
        <textarea
          aria-label={`Add a card to ${column.title}`}
          rows={2}
          maxLength={500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a card… Enter to post"
          className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="mt-1 w-full rounded-lg bg-stone-900 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-30"
        >
          Add card
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3">
        {cards.map((card) => (
          <RetroCard
            key={card.id}
            card={card}
            authorName={names[card.authorId] ?? "Someone"}
            isMine={card.authorId === meId}
            isHost={isHost}
            spotlightId={spotlightId}
            columnIndex={index}
            onReveal={(revealed) => onReveal(card.id, revealed)}
            onEdit={(text) => onEdit(card.id, text)}
            onDelete={() => onDelete(card.id)}
          />
        ))}
        {cards.length === 0 && (
          <p className={`px-1 py-6 text-center text-sm ${spot ? "text-stone-500" : "text-stone-400"}`}>
            No cards yet
          </p>
        )}
      </div>
    </section>
  );
}
