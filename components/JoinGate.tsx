"use client";

import { useState } from "react";

type Props = {
  boardName?: string;
  isHost: boolean;
  onJoin: (name: string) => void;
};

export function JoinGate({ boardName, isHost, onJoin }: Props) {
  const [name, setName] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onJoin(name.trim());
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Retro</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">{boardName ?? "Join the retro"}</h1>
        <p className="mt-2 text-sm text-stone-600">
          {isHost
            ? "You're the host. Enter your name so your own cards appear on the board too."
            : "Enter your name so the team knows whose cards are whose."}
        </p>
        <label htmlFor="name" className="mt-5 block text-sm font-medium text-stone-700">
          Your name
        </label>
        <input
          id="name"
          autoFocus
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Priya"
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="mt-4 w-full rounded-lg bg-stone-900 px-4 py-2.5 font-semibold text-white hover:bg-stone-700 disabled:opacity-40"
        >
          Join the retro
        </button>
      </form>
    </main>
  );
}
