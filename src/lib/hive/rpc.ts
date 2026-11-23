import "server-only";
import { HIVE_FEED } from "@/lib/config";

export class HiveRpcError extends Error {}

/**
 * Hive JSON-RPC over the public nodes in `HIVE_FEED.nodes`, falling through to the next
 * node on a network error, HTTP error, timeout or RPC error. Throws `HiveRpcError` when
 * every node fails, so callers render a failed read as a failure.
 */
export async function hiveRpc<T>(
  method: string,
  params: unknown,
  init: { revalidate?: number; tags?: string[]; timeoutMs?: number } = {},
): Promise<T> {
  const errors: string[] = [];
  for (const node of HIVE_FEED.nodes) {
    try {
      const res = await fetch(node, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
        next: { revalidate: init.revalidate ?? 60, tags: init.tags },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { result?: T; error?: { message?: string } };
      if (json.error) throw new Error(json.error.message ?? "rpc error");
      if (json.result === undefined) throw new Error("empty result");
      return json.result;
    } catch (e) {
      errors.push(`${new URL(node).host}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new HiveRpcError(`${method} failed on every node (${errors.join("; ")})`);
}
