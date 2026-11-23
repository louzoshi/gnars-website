import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { authorOf } from "./discussion";
import { buildHiveCommentOperation, HIVE_BODY_MAX, hivePublishPayloadSchema } from "./publish";

const MEMBER = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01" as const;
const base = {
  member: MEMBER,
  nonce: "7f1c2a4e-0000-4000-8000-000000000001",
  account: "gnars.feed",
  container: { author: "gnars.feed", permlink: "container" },
  app: "gnars.com",
  tag: "gnars",
};

describe("hivePublishPayloadSchema", () => {
  it("accepts a post and a comment, trimming the body", () => {
    expect(hivePublishPayloadSchema.parse({ kind: "post", body: "  hi  " })).toEqual({
      kind: "post",
      body: "hi",
    });
    expect(
      hivePublishPayloadSchema.safeParse({
        kind: "comment",
        parent: { author: "alice", permlink: "p-1" },
        body: "yo",
      }).success,
    ).toBe(true);
  });

  it("rejects empty, oversized and malformed input", () => {
    expect(hivePublishPayloadSchema.safeParse({ kind: "post", body: "   " }).success).toBe(false);
    expect(
      hivePublishPayloadSchema.safeParse({ kind: "post", body: "x".repeat(HIVE_BODY_MAX + 1) })
        .success,
    ).toBe(false);
    expect(
      hivePublishPayloadSchema.safeParse({
        kind: "comment",
        parent: { author: "A!", permlink: "p" },
        body: "x",
      }).success,
    ).toBe(false);
    expect(hivePublishPayloadSchema.safeParse({ kind: "comment", body: "x" }).success).toBe(false);
  });
});

describe("buildHiveCommentOperation", () => {
  it("posts reply to the container, comments reply to their parent", () => {
    const post = buildHiveCommentOperation({ ...base, payload: { kind: "post", body: "gm" } });
    expect(post).toMatchObject({
      parent_author: "gnars.feed",
      parent_permlink: "container",
      author: "gnars.feed",
    });
    const comment = buildHiveCommentOperation({
      ...base,
      payload: { kind: "comment", parent: { author: "alice", permlink: "p1" }, body: "nice" },
    });
    expect(comment).toMatchObject({ parent_author: "alice", parent_permlink: "p1" });
  });

  it("derives a stable, valid permlink from member and nonce", () => {
    const a = buildHiveCommentOperation({ ...base, payload: { kind: "post", body: "a" } });
    const b = buildHiveCommentOperation({ ...base, payload: { kind: "post", body: "b" } });
    const c = buildHiveCommentOperation({
      ...base,
      nonce: "other",
      payload: { kind: "post", body: "a" },
    });
    expect(a.permlink).toMatch(/^gnars-[0-9a-f]{16}$/);
    expect(a.permlink).toBe(b.permlink);
    expect(a.permlink).not.toBe(c.permlink);
  });

  it("writes metadata the feed reads back as the member", () => {
    const op = buildHiveCommentOperation({
      ...base,
      payload: { kind: "post", body: "clip ![](https://gateway.pinata.cloud/ipfs/abc)" },
    });
    const meta = JSON.parse(op.json_metadata);
    expect(meta).toMatchObject({
      app: "gnars.com",
      tags: ["gnars"],
      image: ["https://gateway.pinata.cloud/ipfs/abc"],
    });
    const node = {
      author: op.author,
      permlink: op.permlink,
      parent_author: op.parent_author,
      parent_permlink: op.parent_permlink,
      body: op.body,
      created: "2026-01-01T00:00:00",
      updated: "2026-01-01T00:00:00",
      children: 0,
      replies: [],
      json_metadata: op.json_metadata,
    };
    expect(authorOf(node, "gnars.feed")).toEqual({ kind: "member", address: getAddress(MEMBER) });
  });
});
