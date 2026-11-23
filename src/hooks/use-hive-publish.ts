"use client";

import { useCallback } from "react";
import { useWriteAccount } from "@/hooks/use-write-account";
import type { HivePublishPayload } from "@/lib/hive/publish";
import { signWalletRequest } from "@/lib/wallet-authorization";

const PATH = "/api/hive-feed/publish";

export type HivePublishError =
  | "notConnected"
  | "tooFast"
  | "blocked"
  | "notInFeed"
  | "unavailable"
  | "authExpired"
  | "rejected"
  | "failed";

export type HivePublishResult =
  | { ok: true; dryRun: boolean; id?: string }
  | { ok: false; error: HivePublishError };

const BY_STATUS: Record<number, HivePublishError> = {
  401: "authExpired",
  403: "blocked",
  404: "notInFeed",
  429: "tooFast",
  502: "rejected",
  503: "unavailable",
};

/**
 * Signs a feed post/comment with the user's signing account (silent for email wallets) and
 * sends it to the publish route, which posts it to Hive through the shared Gnars account.
 */
export function useHivePublish() {
  const writer = useWriteAccount();
  const publish = useCallback(
    async (payload: HivePublishPayload): Promise<HivePublishResult> => {
      if (!writer) return { ok: false, error: "notConnected" };
      try {
        const authorization = await signWalletRequest(writer.account, {
          method: "POST",
          path: PATH,
          payload,
        });
        const res = await fetch(PATH, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ payload, authorization }),
        });
        if (!res.ok) return { ok: false, error: BY_STATUS[res.status] ?? "failed" };
        const json = (await res.json()) as { dryRun?: boolean; id?: string };
        return { ok: true, dryRun: Boolean(json.dryRun), id: json.id };
      } catch {
        return { ok: false, error: "failed" };
      }
    },
    [writer],
  );
  return { publish, canSign: Boolean(writer) };
}
