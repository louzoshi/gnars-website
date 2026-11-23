/**
 * Exercises POST /api/hive-feed/publish against a running dev server with throwaway wallets.
 * Run the server in dry-run so nothing is broadcast:
 *
 *   HIVE_FEED_DRY_RUN=1 HIVE_FEED_ACCOUNT=<author> HIVE_FEED_CONTAINER=<author>/<permlink> pnpm dev
 *   SITE=http://localhost:3000 pnpm exec tsx scripts/hive-publish-check.ts <author> <permlink>
 *
 * Checks: a post and a comment pass (dry run), and a comment outside the feed, an empty body,
 * a signature from another wallet and a payload changed after signing are refused.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { walletAuthorizationMessage } from "../src/lib/wallet-authorization";

const URL = `${process.env.SITE ?? "http://localhost:3000"}/api/hive-feed/publish`;
const PATH = "/api/hive-feed/publish";
const acct = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());

async function send(payload: unknown, opts: { signer?: typeof acct; tamper?: boolean } = {}) {
  const signer = opts.signer ?? acct;
  const auth = { walletAddress: acct.address, issuedAt: Date.now(), nonce: crypto.randomUUID() };
  const signature = await signer.signMessage({
    message: walletAuthorizationMessage(auth, { method: "POST", path: PATH, payload }),
  });
  const body = {
    payload: opts.tamper ? { ...(payload as object), body: "tampered" } : payload,
    authorization: { ...auth, signature },
  };
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const feed = await (
    await fetch("https://api.hive.blog", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "bridge.get_discussion",
        params: { author: process.argv[2], permlink: process.argv[3] },
      }),
    })
  ).json();
  const entry = Object.values(
    feed.result as Record<string, { author: string; permlink: string; depth: number }>,
  ).find((n) => n.depth === 1)!;

  const cases: [string, Promise<{ status: number; json: unknown }>, number][] = [
    ["post (dry run)", send({ kind: "post", body: "gm from the test" }), 200],
    [
      "comment on a feed entry",
      send({
        kind: "comment",
        parent: { author: entry.author, permlink: entry.permlink },
        body: "nice",
      }),
      200,
    ],
    [
      "comment outside the feed",
      send({ kind: "comment", parent: { author: "nobody", permlink: "nothing-here" }, body: "x" }),
      404,
    ],
    ["empty body", send({ kind: "post", body: "   " }), 400],
    ["signed by someone else", send({ kind: "post", body: "spoof" }, { signer: other }), 401],
    ["payload changed after signing", send({ kind: "post", body: "orig" }, { tamper: true }), 401],
  ];
  let fail = 0;
  for (const [label, p, want] of cases) {
    const r = await p;
    const ok = r.status === want;
    if (!ok) fail++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${label}: ${r.status}`,
      want === 200 ? JSON.stringify(r.json).slice(0, 400) : "",
    );
  }
  console.log(fail ? `${fail} FAILED` : "ALL PASS");
}
main();
