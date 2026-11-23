import "server-only";
import { Client, PrivateKey } from "@hiveio/dhive";
import { HIVE_FEED } from "@/lib/config";
import type { HiveCommentOperation } from "./publish";

/** Posting key of the shared account, or null (→ dry run). Never the active or owner key. */
export function hivePostingKey(): string | null {
  if (process.env.HIVE_FEED_DRY_RUN === "1") return null;
  return process.env.HIVE_POSTING_KEY?.trim() || null;
}

export async function broadcastHiveComment(op: HiveCommentOperation, postingKey: string) {
  const client = new Client([...HIVE_FEED.nodes], { timeout: 10_000, failoverThreshold: 1 });
  return client.broadcast.comment(op, PrivateKey.fromString(postingKey));
}
