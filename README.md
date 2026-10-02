# Retro

A simple collaborative retro board for Scrum teams. One board, one link, hidden cards, and a
host-run spotlight for talking through each person's cards.

## How it works

1. Open the app and click **Create the board**. Name the retro and confirm the column titles.
2. You land on the board as the host. Enter your name like everyone else.
3. Click **Copy invite link** and share it. Teammates open it, type their name and are in.
4. Everyone adds cards. A card is hidden from others until its author clicks **Reveal**
   (the host can also reveal any card).
5. The host uses **Spotlight** to pick a person. Their cards light up and everyone else's dim.
   Go round the room with **Next** and **Previous**, then **End spotlight**.

Boards are kept for 30 days.

## Deploy to Vercel

The board needs a small shared database so everyone sees the same thing. Vercel provides one
for free as a storage add-on.

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo, and click **Deploy** with the defaults.
3. Open the new project, go to the **Storage** tab, click **Create Database**, choose
   **Upstash → Redis** (Marketplace), pick the free plan, and connect it to the project
   for all environments. Vercel adds the connection settings to the project automatically.
4. Go to **Deployments**, open the menu on the latest deployment and click **Redeploy**
   so the new settings take effect.
5. Open the project URL and create your first retro.

If you skip step 3, the app still loads but shows a red warning: without storage, each
visitor would see their own private copy of the board.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Locally the app uses in-memory storage, so no setup is needed.
To use a real Redis locally, copy `.env.example` to `.env.local` and fill in the values.

## Notes for maintainers

- Next.js App Router, Tailwind CSS, no other UI dependencies.
- `lib/board.ts` holds all board rules as a pure function (`applyAction`) and the per-viewer
  filtering (`toView`). Hidden card text never leaves the server.
- `lib/store.ts` stores each board as one JSON document with a compare-and-set write, so
  simultaneous edits from the team never overwrite each other.
- Clients poll every 1.5 seconds and get a tiny "unchanged" response when nothing moved.
- The host is whoever holds the host token, which is handed over once in the creator's URL
  and then kept in that browser. Participants are identified by a random id kept in their
  browser, so a refresh keeps their name and cards.
