"use client";

import { useState } from "react";
import type { CardView } from "@/lib/types";

const PALETTE = [
  "bg-amber-200",
  "bg-rose-200",
  "bg-sky-200",
  "bg-emerald-200",
  "bg-violet-200",
  "bg-orange-200",
];
const TILTS = ["-rotate-1", "rotate-1", "rotate-0", "-rotate-[0.6deg]", "rotate-[0.6deg]", "rotate-0"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Props = {
  card: CardView;
  authorName: string;
  isMine: boolean;
  isHost: boolean;
  spotlightId: string | null;
  columnIndex: number;
  onReveal: (revealed: boolean) => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
};

export function RetroCard({
  card,
  authorName,
  isMine,
  isHost,
  spotlightId,
  columnIndex,
  onReveal,
  onEdit,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text ?? "");

  const hiddenFromMe = card.text === null;
  const spotOn = spotlightId !== null;
  const inSpot = spotOn && card.authorId === spotlightId;
  const dimmed = spotOn && !inSpot;

  const tilt = inSpot ? "rotate-0" : TILTS[hash(card.id) % TILTS.length];
  const surface = hiddenFromMe
    ? "bg-stone-200 border-2 border-dashed border-stone-400"
    : PALETTE[columnIndex % PALETTE.length];

  const classes = [
    "relative rounded-sm p-3 shadow-md transition-all duration-500 ease-out",
    surface,
    tilt,
    inSpot ? "z-10 scale-[1.03] ring-4 ring-amber-400 shadow-[0_0_36px_rgba(251,191,36,0.55)]" : "",
    dimmed ? "opacity-25 saturate-50 hover:opacity-70" : "",
  ].join(" ");

  function save() {
    const text = draft.trim();
    if (text && text !== card.text) onEdit(text);
    setEditing(false);
  }

  if (hiddenFromMe) {
    return (
      <article className={classes} data-testid="card-hidden">
        <div className="flex min-h-20 flex-col justify-between">
          <p className="text-sm italic text-stone-500">Hidden until {authorName} reveals it</p>
          <div className="mt-3 flex items-center justify-between text-xs text-stone-600">
            <span className="font-medium">{authorName}</span>
            {isHost && (
              <button
                type="button"
                onClick={() => onReveal(true)}
                className="rounded bg-stone-800 px-2 py-1 font-medium text-white hover:bg-stone-600"
              >
                Reveal
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={classes} data-testid={card.revealed ? "card-revealed" : "card-mine-hidden"}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <textarea
            autoFocus
            rows={3}
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full resize-none rounded bg-white/70 p-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="mt-2 flex gap-2 text-xs">
            <button type="submit" className="rounded bg-stone-900 px-2 py-1 font-medium text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-2 py-1 hover:bg-stone-900/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-stone-900">
            {card.text}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-stone-700">
            <span className="truncate font-medium">{isMine ? `${authorName} (you)` : authorName}</span>
            <div className="flex shrink-0 items-center gap-1">
              {isMine && !card.revealed && (
                <span className="rounded bg-stone-900/10 px-1.5 py-0.5 text-[11px]">Hidden</span>
              )}
              {isMine && (
                <button
                  type="button"
                  onClick={() => onReveal(!card.revealed)}
                  className={
                    card.revealed
                      ? "rounded px-2 py-1 font-medium hover:bg-stone-900/10"
                      : "rounded bg-stone-900 px-2 py-1 font-medium text-white hover:bg-stone-700"
                  }
                >
                  {card.revealed ? "Hide" : "Reveal"}
                </button>
              )}
              {isMine && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(card.text ?? "");
                    setEditing(true);
                  }}
                  className="rounded px-2 py-1 hover:bg-stone-900/10"
                >
                  Edit
                </button>
              )}
              {(isMine || isHost) && (
                <button
                  type="button"
                  aria-label="Delete card"
                  onClick={() => {
                    if (window.confirm("Delete this card?")) onDelete();
                  }}
                  className="rounded px-2 py-1 hover:bg-stone-900/10"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </article>
  );
}
