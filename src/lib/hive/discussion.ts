import { getAddress, isAddress } from "viem";

/** One node of `bridge.get_discussion`'s flat map (fields the feed reads). */
export interface HiveDiscussionNode {
  author: string;
  permlink: string;
  parent_author: string;
  parent_permlink: string;
  body: string;
  created: string;
  updated: string;
  children: number;
  replies: string[];
  json_metadata: unknown;
  stats?: { hide?: boolean; gray?: boolean; total_votes?: number };
  active_votes?: unknown[];
  pending_payout_value?: string;
}

/** Who wrote an entry: a Gnars member (lite, via the shared account) or a Hive account. */
export type HiveFeedAuthor =
  | { kind: "member"; address: `0x${string}` }
  | { kind: "hive"; account: string };

export interface HiveFeedEntry {
  /** `author/permlink` on Hive — the entry's stable id. */
  id: string;
  hiveAuthor: string;
  permlink: string;
  author: HiveFeedAuthor;
  body: string;
  /** ISO with `Z`: Hive timestamps are UTC without a zone. */
  createdAt: string;
  edited: boolean;
  votes: number;
  /** Every reply below this one, at any depth (Hive's `children`). */
  replyCount: number;
  replies: HiveFeedEntry[];
}

export interface BuildFeedOptions {
  /** Shared posting account; a member identity is trusted only on its entries. */
  feedAccount: string | null;
  /** `author/permlink` ids hidden by moderation (the entry and its thread). */
  hidden?: ReadonlySet<string>;
}

const asUtcIso = (t: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);

function metadataOf(node: HiveDiscussionNode): Record<string, unknown> {
  const raw = node.json_metadata;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * The member behind an entry. Only the shared account's entries can claim one: anyone can
 * write `gnars.address` into their own metadata, but only the site's server signs as the
 * shared account, and it writes the address it verified.
 */
export function authorOf(node: HiveDiscussionNode, feedAccount: string | null): HiveFeedAuthor {
  if (feedAccount && node.author === feedAccount) {
    const gnars = metadataOf(node).gnars as { address?: unknown } | undefined;
    const address = gnars?.address;
    if (typeof address === "string" && isAddress(address)) {
      return { kind: "member", address: getAddress(address) };
    }
  }
  return { kind: "hive", account: node.author };
}

/**
 * Turns `bridge.get_discussion` (a flat `author/permlink → node` map holding the root and
 * every reply) into the feed: the root's direct replies, newest first, each with its thread
 * in conversation order (oldest first). Entries Hive communities mute (`hide`/`gray`) and
 * ids in `hidden` drop out with their whole thread.
 */
export function buildFeed(
  discussion: Record<string, HiveDiscussionNode>,
  root: { author: string; permlink: string },
  { feedAccount, hidden = new Set() }: BuildFeedOptions,
): HiveFeedEntry[] {
  const visit = (id: string, depth: number): HiveFeedEntry | null => {
    const node = discussion[id];
    if (!node || hidden.has(id) || node.stats?.hide || node.stats?.gray) return null;
    const replies = (node.replies ?? [])
      .map((r) => (depth < 32 ? visit(r, depth + 1) : null))
      .filter((e): e is HiveFeedEntry => e !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      id,
      hiveAuthor: node.author,
      permlink: node.permlink,
      author: authorOf(node, feedAccount),
      body: node.body,
      createdAt: asUtcIso(node.created),
      edited: node.updated !== node.created,
      votes: node.stats?.total_votes ?? node.active_votes?.length ?? 0,
      replyCount: node.children,
      replies,
    };
  };

  const rootNode = discussion[`${root.author}/${root.permlink}`];
  if (!rootNode) return [];
  return (rootNode.replies ?? [])
    .map((id) => visit(id, 1))
    .filter((e): e is HiveFeedEntry => e !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
