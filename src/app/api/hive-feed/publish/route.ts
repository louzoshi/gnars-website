import { revalidateTag } from "next/cache";
import { HIVE_FEED } from "@/lib/config";
import { broadcastHiveComment, hivePostingKey } from "@/lib/hive/broadcast";
import { countRecentByMember, type HiveDiscussionNode } from "@/lib/hive/discussion";
import { buildHiveCommentOperation, hivePublishPayloadSchema } from "@/lib/hive/publish";
import { hiveRpc } from "@/lib/hive/rpc";
import {
  enforceRateLimit,
  readJsonBody,
  RequestSecurityError,
  requestSecurityResponse,
  verifyWalletAuthorization,
} from "@/lib/server/request-security";
import { HIVE_FEED_TAG } from "@/services/hive-feed";

export const dynamic = "force-dynamic";

const PATH = "/api/hive-feed/publish";

/**
 * Publishes a member's post or comment to Hive through the shared Gnars account.
 * Body: `{ payload, authorization }`, where `authorization` is `signWalletRequest(account,
 * { method: "POST", path, payload })`. With no posting key configured (or HIVE_FEED_DRY_RUN=1)
 * it validates everything and returns the operation without broadcasting.
 */
export async function POST(request: Request) {
  try {
    const { account, container } = HIVE_FEED;
    if (!account || !container)
      throw new RequestSecurityError(503, "The feed is not connected to Hive yet.");

    await enforceRateLimit(request, { scope: "hive-feed:ip", limit: 30, windowSeconds: 600 });
    const raw = (await readJsonBody(request, 32_000)) as {
      payload?: unknown;
      authorization?: unknown;
    };
    const parsed = hivePublishPayloadSchema.safeParse(raw?.payload);
    if (!parsed.success) throw new RequestSecurityError(400, "Invalid post.");
    const payload = parsed.data;

    const member = await verifyWalletAuthorization({
      authorization: raw.authorization,
      method: "POST",
      path: PATH,
      payload: raw.payload,
    });
    if (HIVE_FEED.blockedAddresses.includes(member)) {
      throw new RequestSecurityError(403, "This wallet can't post here.");
    }
    await enforceRateLimit(request, {
      scope: "hive-feed:member",
      subject: member,
      ...HIVE_FEED.rateLimit,
    });

    // Fresh read: the comment check needs the live thread, and the limit counts the member's
    // entries on Hive itself so it holds across server instances.
    const discussion = await hiveRpc<Record<string, HiveDiscussionNode> | null>(
      "bridge.get_discussion",
      container,
      { revalidate: 0 },
    );
    if (!discussion) throw new RequestSecurityError(503, "Couldn't reach Hive. Try again.");
    const { limit, windowSeconds } = HIVE_FEED.rateLimit;
    if (
      countRecentByMember(discussion, account, member, Date.now() - windowSeconds * 1000) >= limit
    ) {
      throw new RequestSecurityError(
        429,
        "You're posting too fast. Try again in a few minutes.",
        60,
      );
    }
    if (payload.kind === "comment") {
      // Comments only inside this feed: the parent must be an entry under the container.
      const parentId = `${payload.parent.author}/${payload.parent.permlink}`;
      const rootId = `${container.author}/${container.permlink}`;
      if (!discussion[parentId] || parentId === rootId || HIVE_FEED.hidden.includes(parentId)) {
        throw new RequestSecurityError(404, "That post is not in this feed.");
      }
    }

    const { nonce } = raw.authorization as { nonce: string };
    const operation = buildHiveCommentOperation({
      payload,
      member,
      nonce,
      account,
      container,
      app: HIVE_FEED.app,
      tag: HIVE_FEED.tag,
    });

    const key = hivePostingKey();
    if (!key)
      return Response.json(
        { dryRun: true, operation },
        { headers: { "Cache-Control": "no-store" } },
      );

    try {
      await broadcastHiveComment(operation, key);
    } catch (e) {
      console.error("[hive-feed/publish] broadcast", e);
      const msg = e instanceof Error ? e.message : "";
      // Hive allows one reply per account every 3 s; a burst from several members hits it.
      if (/HIVE_MIN_REPLY_INTERVAL|RC|bandwidth/i.test(msg)) {
        throw new RequestSecurityError(429, "Hive is busy. Try again in a few seconds.", 5);
      }
      throw new RequestSecurityError(502, "Hive didn't accept the post. Try again.");
    }
    revalidateTag(HIVE_FEED_TAG, { expire: 0 });
    return Response.json(
      { id: `${operation.author}/${operation.permlink}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof RequestSecurityError)) console.error("[hive-feed/publish]", error);
    return requestSecurityResponse(error);
  }
}
