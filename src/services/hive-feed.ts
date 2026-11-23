import "server-only";
import { HIVE_FEED } from "@/lib/config";
import { buildFeed, type HiveDiscussionNode, type HiveFeedEntry } from "@/lib/hive/discussion";
import { hiveRpc } from "@/lib/hive/rpc";

export const HIVE_FEED_TAG = "hive-feed";

export type HiveFeedResult =
  | { status: "ok"; entries: HiveFeedEntry[] }
  | { status: "unconfigured" }
  | { status: "error" };

/** The /community/hive feed: every reply under the configured container post. */
export async function getHiveFeed(): Promise<HiveFeedResult> {
  const container = HIVE_FEED.container;
  if (!container) return { status: "unconfigured" };
  try {
    const discussion = await hiveRpc<Record<string, HiveDiscussionNode> | null>(
      "bridge.get_discussion",
      container,
      { revalidate: 60, tags: [HIVE_FEED_TAG] },
    );
    if (!discussion) return { status: "error" };
    return {
      status: "ok",
      entries: buildFeed(discussion, container, { feedAccount: HIVE_FEED.account }),
    };
  } catch (e) {
    console.error("[hive-feed]", e);
    return { status: "error" };
  }
}
