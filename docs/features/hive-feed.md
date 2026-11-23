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

## Publishing

1. `HiveComposer` (post, or reply under any entry) attaches an image through Pinata as a
   markdown image, then `useHivePublish` signs `{ kind, body, parent? }` with
   `signWalletRequest` — silent for email wallets — and POSTs `{ payload, authorization }`.
2. `POST /api/hive-feed/publish` checks, in order: feed configured (else 503), per-IP limit,
   payload (`hivePublishPayloadSchema`), wallet signature (`verifyWalletAuthorization`),
   `blockedAddresses`, the member's entries in the last 10 min read from Hive itself
   (`countRecentByMember`, so it holds across instances), and for comments that the parent is
   inside the container.
3. `buildHiveCommentOperation` makes the `comment` op; its permlink comes from the request
   nonce, so a replayed request rewrites the same entry instead of posting twice.
4. With `HIVE_POSTING_KEY` set (and `HIVE_FEED_DRY_RUN` not `1`) it broadcasts with
   `@hiveio/dhive` and revalidates `hive-feed`; otherwise it returns `{ dryRun, operation }`
   and the composer says so.

Error statuses map to translated messages on the client (`errors.*` in `hiveFeed.json`).

## Moderation

By hand in `HIVE_FEED` (deploy to apply): `hidden` (entry ids, drops the thread) and
`blockedAddresses`. Limit: `rateLimit` (5 per 10 min per member).

## Status

Built: feed, composer, replies, signed publish route with dry run. Verified with
`scripts/hive-publish-check.ts` (dry run) and an offline signature check. Not verified: the
composer while logged in (needs a real email login) and a real broadcast. Blocked on the Gnars
Hive account (creation, RC via HP delegation, posting key in Vercel) and on creating the
container post. The route is not linked from the nav until posting works.

Local preview with real data:
`HIVE_FEED_DRY_RUN=1 HIVE_FEED_ACCOUNT=peak.snaps HIVE_FEED_CONTAINER=peak.snaps/<snap-container-…> pnpm dev`.

## Go-live checklist

1. Create the Gnars Hive account; delegate HP so it has RC to post.
2. Publish the container post from it (any Hive client) and note its permlink.
3. Vercel (server-only): `HIVE_FEED_ACCOUNT`, `HIVE_FEED_CONTAINER=<account>/<permlink>`,
   `HIVE_POSTING_KEY` (posting key only).
4. Post and reply once from an email login on production; check it on peakd.
5. Link the route from the nav.

## Limits to keep in mind

- `get_discussion` returns the whole container; Next's data cache skips responses over 2 MB.
  Past a few hundred posts, rotate containers (as snaps does) or paginate.
