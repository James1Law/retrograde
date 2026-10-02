"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, BoardView, CardView } from "@/lib/types";
import {
  ApiError,
  fetchBoard,
  loadHostToken,
  loadIdentity,
  newParticipantId,
  saveHostToken,
  saveIdentity,
  sendAction,
  type Identity,
} from "@/lib/client";
import { JoinGate } from "./JoinGate";
import { ColumnView } from "./ColumnView";

const POLL_MS = 1500;

type Session = { hostToken: string | null; identity: Identity | null };

// Static class names so Tailwind can see them; one row of columns from laptop widths up.
const GRID_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function Board({ boardId }: { boardId: string }) {
  // Who we are in this browser. Null until read from localStorage after mount.
  const [session, setSession] = useState<Session | null>(null);
  const identity = session?.identity ?? null;
  const hostToken = session?.hostToken ?? null;
  const ready = session !== null;
  const [view, setView] = useState<BoardView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const viewRef = useRef<BoardView | null>(null);

  // Pick up the host token from the creator's URL once, then hide it from the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("host");
    if (fromUrl) {
      saveHostToken(boardId, fromUrl);
      url.searchParams.delete("host");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
    setSession({ hostToken: loadHostToken(boardId), identity: loadIdentity(boardId) });
  }, [boardId]);

  // Ignore responses that arrive out of order.
  const apply = useCallback((next: BoardView) => {
    if (viewRef.current && next.version < viewRef.current.version) return;
    viewRef.current = next;
    setView(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 404) setNotFound(true);
      else setToast(e.message);
    } else {
      setOffline(true);
    }
  }, []);

  // Before joining, fetch once so the join screen can show the retro's name.
  useEffect(() => {
    if (!ready || identity) return;
    fetchBoard(boardId, null, hostToken)
      .then((v) => {
        if (!("unchanged" in v)) apply(v);
      })
      .catch(handleError);
  }, [ready, identity, boardId, hostToken, apply, handleError]);

  // Once we know who we are: join, then keep polling.
  useEffect(() => {
    if (!ready || !identity) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    viewRef.current = null;

    const tick = async () => {
      try {
        const res = await fetchBoard(boardId, identity, hostToken, viewRef.current?.version);
        if (cancelled) return;
        if (!("unchanged" in res)) apply(res);
        setOffline(false);
      } catch (e) {
        if (!cancelled) handleError(e);
      }
    };

    (async () => {
      try {
        const v = await sendAction(boardId, identity, hostToken, {
          type: "join",
          name: identity.name,
        });
        if (cancelled) return;
        apply(v);
        setOffline(false);
      } catch (e) {
        if (!cancelled) handleError(e);
      }
      if (!cancelled) timer = setInterval(tick, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [ready, identity, hostToken, boardId, apply, handleError]);

  const act = useCallback(
    async (action: Action) => {
      if (!identity) return;
      try {
        apply(await sendAction(boardId, identity, hostToken, action));
      } catch (e) {
        handleError(e);
      }
    },
    [boardId, identity, hostToken, apply, handleError],
  );

  const join = useCallback(
    (name: string) => {
      const next: Identity = { id: identity?.id ?? newParticipantId(), name };
      saveIdentity(boardId, next);
      setSession((s) => ({ hostToken: s?.hostToken ?? null, identity: next }));
    },
    [boardId, identity],
  );

  const copyLink = useCallback(async () => {
    const link = `${window.location.origin}/b/${boardId}`;
    try {
      await navigator.clipboard.writeText(link);
      setToast("Invite link copied");
    } catch {
      window.prompt("Copy this link and share it with the team", link);
    }
  }, [boardId]);

  if (notFound) {
    return (
      <Centered>
        <h1 className="text-2xl font-bold text-stone-900">This retro doesn&apos;t exist</h1>
        <p className="mt-2 text-stone-600">
          Check the link, or{" "}
          <Link href="/" className="font-medium text-amber-700 underline">
            start a new retro
          </Link>
          .
        </p>
      </Centered>
    );
  }
  if (!ready) return null;
  if (!identity) {
    return <JoinGate boardName={view?.name} isHost={Boolean(hostToken)} onJoin={join} />;
  }
  if (!view) {
    return (
      <Centered>
        <p className="text-stone-500">Loading the board…</p>
      </Centered>
    );
  }

  const order = view.participants; // join order
  const spotlight = view.spotlightId
    ? (order.find((p) => p.id === view.spotlightId) ?? null)
    : null;
  const spot = spotlight !== null;
  const spotIndex = spotlight ? order.findIndex((p) => p.id === spotlight.id) : -1;

  const names: Record<string, string> = {};
  for (const p of order) names[p.id] = p.name;

  const cardsBy = (pid: string) => view.cards.filter((c) => c.authorId === pid);
  const myHidden = cardsBy(identity.id).filter((c) => !c.revealed).length;

  const setSpotlight = (participantId: string | null) =>
    act({ type: "setSpotlight", participantId });
  const nextPerson = () => {
    if (order.length === 0) return;
    setSpotlight(order[spotIndex === -1 ? 0 : (spotIndex + 1) % order.length].id);
  };
  const prevPerson = () => {
    if (order.length === 0) return;
    setSpotlight(
      order[spotIndex === -1 ? order.length - 1 : (spotIndex - 1 + order.length) % order.length].id,
    );
  };

  const cardsForColumn = (columnId: string): CardView[] =>
    view.cards
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => {
        if (view.spotlightId) {
          const aSpot = a.authorId === view.spotlightId ? 0 : 1;
          const bSpot = b.authorId === view.spotlightId ? 0 : 1;
          if (aSpot !== bSpot) return aSpot - bSpot;
        }
        return a.createdAt - b.createdAt;
      });

  const storageWarning =
    view.storage === "memory" &&
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);

  return (
    <div
      className={`min-h-screen transition-colors duration-700 ${spot ? "bg-slate-900" : "bg-stone-100"}`}
    >
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
              Retro
            </p>
            <h1 className="truncate text-lg font-bold leading-tight text-stone-900">{view.name}</h1>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-1.5" aria-label="Participants">
            {order.map((p) => {
              const isSpot = p.id === view.spotlightId;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!view.isHost}
                  onClick={() => setSpotlight(isSpot ? null : p.id)}
                  title={view.isHost ? (isSpot ? "End spotlight" : `Spotlight ${p.name}`) : undefined}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    isSpot
                      ? "border-amber-500 bg-amber-100 text-amber-900"
                      : "border-stone-200 bg-stone-50 text-stone-700"
                  } ${view.isHost ? "cursor-pointer hover:border-amber-400" : "cursor-default"}`}
                >
                  {p.name}
                  {p.id === identity.id ? " (you)" : ""}
                  {p.isHost ? <span className="text-amber-700"> · host</span> : null}
                  <span className="ml-1 text-stone-400">{cardsBy(p.id).length}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => act({ type: "revealAllMine" })}
              disabled={myHidden === 0}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-40"
            >
              Reveal all mine{myHidden ? ` (${myHidden})` : ""}
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
            >
              Copy invite link
            </button>
          </div>
        </div>

        {view.isHost && (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
              <span className="font-semibold text-amber-900">Host controls</span>
              <span className="text-amber-800">Spotlight:</span>
              <button
                type="button"
                onClick={prevPerson}
                disabled={order.length === 0}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              >
                ◀ Previous
              </button>
              <select
                aria-label="Spotlight participant"
                value={view.spotlightId ?? ""}
                onChange={(e) => setSpotlight(e.target.value || null)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-medium text-amber-900"
              >
                <option value="">Nobody</option>
                {order.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={nextPerson}
                disabled={order.length === 0}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
              >
                Next ▶
              </button>
              {spot && (
                <button
                  type="button"
                  onClick={() => setSpotlight(null)}
                  className="rounded-lg bg-amber-900 px-2.5 py-1 font-medium text-white hover:bg-amber-800"
                >
                  End spotlight
                </button>
              )}
              <span className="ml-auto hidden text-xs text-amber-800 sm:inline">
                Click a name above, or use Next to go round the room.
              </span>
            </div>
          </div>
        )}
      </header>

      {storageWarning && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">
          Shared storage isn&apos;t set up, so other people won&apos;t see this board. Add the
          Redis storage add-on in Vercel (see README) and redeploy.
        </div>
      )}

      {spotlight && (
        <div className="mx-auto max-w-7xl px-4 pt-5">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-400 px-5 py-3 text-amber-950 shadow-lg">
            <span className="text-2xl" aria-hidden>
              🔦
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Spotlight</p>
              <p className="text-lg font-bold leading-tight">
                {spotlight.name}
                {spotlight.id === identity.id && (
                  <span className="font-medium"> · that&apos;s you. Reveal each card as you talk it through.</span>
                )}
              </p>
            </div>
            <span className="ml-auto text-sm font-medium">
              {cardsBy(spotlight.id).filter((c) => c.revealed).length} of{" "}
              {cardsBy(spotlight.id).length} cards revealed
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${GRID_COLS[view.columns.length] ?? "lg:grid-cols-6"}`}>
          {view.columns.map((col, i) => (
            <ColumnView
              key={col.id}
              column={col}
              index={i}
              cards={cardsForColumn(col.id)}
              names={names}
              meId={identity.id}
              isHost={view.isHost}
              spotlightId={view.spotlightId}
              onAdd={(text) => act({ type: "addCard", columnId: col.id, text })}
              onReveal={(cardId, revealed) => act({ type: "setRevealed", cardId, revealed })}
              onEdit={(cardId, text) => act({ type: "editCard", cardId, text })}
              onDelete={(cardId) => act({ type: "deleteCard", cardId })}
            />
          ))}
        </div>
      </main>

      {offline && (
        <div className="fixed bottom-4 left-4 rounded-full bg-stone-800 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          Reconnecting…
        </div>
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">{children}</div>
    </main>
  );
}
