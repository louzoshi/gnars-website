const IMAGE_URL = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:\?\S*)?$/i;
const HIVE_IMAGE_HOST =
  /^https?:\/\/(?:images\.hive\.blog|files\.peakd\.com|images\.ecency\.com)\/\S+$/i;

/**
 * Hive apps often post an image as a bare URL on its own line, which markdown renders as
 * a link. Turn those lines into images; leave everything else as written.
 */
export function normalizeHiveBody(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      const t = line.trim();
      return IMAGE_URL.test(t) || HIVE_IMAGE_HOST.test(t) ? `![](${t})` : line;
    })
    .join("\n");
}

/** Hive account avatar, served by the Hive image proxy. */
export const hiveAvatarUrl = (account: string) =>
  `https://images.hive.blog/u/${encodeURIComponent(account)}/avatar/small`;

/** Where to read an entry on a full Hive client. */
export const hiveEntryUrl = (author: string, permlink: string) =>
  `https://peakd.com/@${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`;
