import { describe, expect, it } from "vitest";
import { authorOf, buildFeed, type HiveDiscussionNode } from "./discussion";

const ROOT = { author: "gnars.feed", permlink: "container" };
const ADDR = "0x1234567890abcdef1234567890abcdef12345678";

function node(
  author: string,
  permlink: string,
  parent: string,
  created: string,
  extra: Partial<HiveDiscussionNode> = {},
): HiveDiscussionNode {
  const [parent_author, parent_permlink] = parent.split("/");
  return {
    author,
    permlink,
    parent_author: parent_author ?? "",
    parent_permlink: parent_permlink ?? "",
    body: `${author} says hi`,
    created,
    updated: created,
    children: 0,
    replies: [],
    json_metadata: {},
    ...extra,
  };
}

describe("authorOf", () => {
  it("trusts the member address only on the shared account's entries", () => {
    const meta = { gnars: { address: ADDR } };
    expect(
      authorOf(
        node("gnars.feed", "a", "", "2026-01-01T00:00:00", { json_metadata: meta }),
        "gnars.feed",
      ),
    ).toEqual({
      kind: "member",
      address: "0x1234567890AbcdEF1234567890aBcdef12345678",
    });
    expect(
      authorOf(
        node("mallory", "a", "", "2026-01-01T00:00:00", { json_metadata: meta }),
        "gnars.feed",
      ),
    ).toEqual({
      kind: "hive",
      account: "mallory",
    });
  });

  it("reads metadata stored as a JSON string, and falls back on junk", () => {
    const str = JSON.stringify({ gnars: { address: ADDR } });
    expect(
      authorOf(node("gnars.feed", "a", "", "t", { json_metadata: str }), "gnars.feed").kind,
    ).toBe("member");
    expect(
      authorOf(node("gnars.feed", "a", "", "t", { json_metadata: "{oops" }), "gnars.feed"),
    ).toEqual({
      kind: "hive",
      account: "gnars.feed",
    });
    expect(
      authorOf(
        node("gnars.feed", "a", "", "t", { json_metadata: { gnars: { address: "0xnope" } } }),
        "gnars.feed",
      ).kind,
    ).toBe("hive");
  });

  it("with no feed account configured, nobody is a member", () => {
    const meta = { gnars: { address: ADDR } };
    expect(authorOf(node("gnars.feed", "a", "", "t", { json_metadata: meta }), null).kind).toBe(
      "hive",
    );
  });
});

describe("buildFeed", () => {
  const discussion: Record<string, HiveDiscussionNode> = {
    "gnars.feed/container": node("gnars.feed", "container", "", "2026-01-01T00:00:00", {
      replies: ["alice/p1", "bob/p2", "carol/muted", "dave/hidden"],
    }),
    "alice/p1": node("alice", "p1", "gnars.feed/container", "2026-01-02T00:00:00", {
      children: 2,
      replies: ["bob/c2", "carol/c1"],
    }),
    "bob/p2": node("bob", "p2", "gnars.feed/container", "2026-01-03T00:00:00", {
      updated: "2026-01-03T01:00:00",
      stats: { total_votes: 4 },
    }),
    "carol/muted": node("carol", "muted", "gnars.feed/container", "2026-01-04T00:00:00", {
      stats: { gray: true },
    }),
    "dave/hidden": node("dave", "hidden", "gnars.feed/container", "2026-01-05T00:00:00"),
    "bob/c2": node("bob", "c2", "alice/p1", "2026-01-02T02:00:00"),
    "carol/c1": node("carol", "c1", "alice/p1", "2026-01-02T01:00:00"),
  };
  const feed = buildFeed(discussion, ROOT, {
    feedAccount: "gnars.feed",
    hidden: new Set(["dave/hidden"]),
  });

  it("lists the container's replies newest first, minus muted and hidden ones", () => {
    expect(feed.map((e) => e.id)).toEqual(["bob/p2", "alice/p1"]);
  });

  it("orders a thread oldest first", () => {
    expect(feed[1].replies.map((e) => e.id)).toEqual(["carol/c1", "bob/c2"]);
    expect(feed[1].replyCount).toBe(2);
  });

  it("marks times as UTC, edits, and votes", () => {
    expect(feed[0]).toMatchObject({ createdAt: "2026-01-03T00:00:00Z", edited: true, votes: 4 });
    expect(feed[1].edited).toBe(false);
  });

  it("returns nothing when the container is missing", () => {
    expect(buildFeed({}, ROOT, { feedAccount: null })).toEqual([]);
  });
});
