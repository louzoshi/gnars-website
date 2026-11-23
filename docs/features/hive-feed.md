# Hive community feed (`/community/hive`)

Community posts and comments on Hive, readable by anyone and writable by members who only
log in with email (thirdweb in-app wallet), like SkateHive's lite accounts. Caldo: GNARS-8.

## Model

- **Lite accounts.** A member without a Hive key publishes through one shared Gnars Hive
  account (`HIVE_FEED_ACCOUNT`). The server verifies the member's wallet signature, then
  signs the Hive operation with the account's posting key and writes the member's address in
  `json_metadata.gnars.address`. The site shows the member (avatar, name, `/members/[address]`).
- **Trust.** A member identity is read only from entries authored by the shared account
  (`authorOf` in `src/lib/hive/discussion.ts`). Anyone can put an address in their own
  metadata; only our server signs as the shared account.
- **Container.** The feed is every reply under one container post (`HIVE_FEED_CONTAINER`,
  `author/permlink`), the snaps model. Hive allows one root post per account per 5 min but a
  reply every 3 s, so posts are replies. Comments are replies to those.
- **Reads.** `bridge.get_discussion` on public nodes (`HIVE_FEED.nodes`, with fallback),
  cached 60 s under tag `hive-feed`. Muted entries (`stats.hide`/`gray`) are dropped. A failed
  read renders an error, never an empty feed.

## Where things live

- `src/lib/config.ts` — `HIVE_FEED` (account, container, nodes, tag, app)
- `src/lib/hive/discussion.ts` — discussion → feed tree, author identity (tested)
- `src/lib/hive/body.ts` — bare image URLs → images, avatar and peakd links (tested)
- `src/lib/hive/rpc.ts` — server-only JSON-RPC with node fallback
- `src/services/hive-feed.ts` — `getHiveFeed()` → `ok | unconfigured | error`
- `src/components/hive-feed/` — page body and the entry/thread component
- `messages/{en,pt-br}/hiveFeed.json`

## Status

Built: read-only feed. Not built yet: composer, signed publish route, per-address rate limit,
hide list. Blocked on the Gnars Hive account (creation, RC via HP delegation, posting key in
Vercel). The route is not linked from the nav until posting works.

Local preview with real data: `HIVE_FEED_CONTAINER=peak.snaps/<snap-container-…> pnpm dev`.

## Limits to keep in mind

- `get_discussion` returns the whole container; Next's data cache skips responses over 2 MB.
  Past a few hundred posts, rotate containers (as snaps does) or paginate.
