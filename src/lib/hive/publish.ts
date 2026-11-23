import { keccak256, toBytes } from "viem";
import { z } from "zod";

export const HIVE_BODY_MAX = 4000;

const hiveName = z.string().regex(/^[a-z][a-z0-9.-]{2,15}$/);
const hivePermlink = z.string().regex(/^[a-z0-9-]{1,255}$/);

/** What the client signs and sends: a post (reply to the container) or a comment on an entry. */
export const hivePublishPayloadSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("post"), body: z.string().trim().min(1).max(HIVE_BODY_MAX) }),
  z.object({
    kind: z.literal("comment"),
    parent: z.object({ author: hiveName, permlink: hivePermlink }),
    body: z.string().trim().min(1).max(HIVE_BODY_MAX),
  }),
]);
export type HivePublishPayload = z.infer<typeof hivePublishPayloadSchema>;

export interface HiveCommentOperation {
  parent_author: string;
  parent_permlink: string;
  author: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: string;
}

const IMAGE_IN_MARKDOWN = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

/**
 * The Hive `comment` operation the shared account broadcasts for a member. The permlink comes
 * from the signed request's nonce, so replaying the same signed request rewrites the same
 * entry with the same text instead of posting twice.
 */
export function buildHiveCommentOperation(args: {
  payload: HivePublishPayload;
  member: `0x${string}`;
  nonce: string;
  account: string;
  container: { author: string; permlink: string };
  app: string;
  tag: string;
}): HiveCommentOperation {
  const { payload, member, nonce, account, container, app, tag } = args;
  const parent = payload.kind === "post" ? container : payload.parent;
  const body = payload.body.trim();
  const image = [...body.matchAll(IMAGE_IN_MARKDOWN)].map((m) => m[1]).slice(0, 4);
  return {
    parent_author: parent.author,
    parent_permlink: parent.permlink,
    author: account,
    permlink: `gnars-${keccak256(toBytes(`${member.toLowerCase()}:${nonce}`)).slice(2, 18)}`,
    title: "",
    body,
    json_metadata: JSON.stringify({
      app,
      format: "markdown",
      tags: [tag],
      ...(image.length ? { image } : {}),
      gnars: { address: member.toLowerCase(), v: 1 },
    }),
  };
}
