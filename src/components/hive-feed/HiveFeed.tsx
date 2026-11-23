import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { HiveFeedResult } from "@/services/hive-feed";
import { HiveEntry } from "./HiveEntry";

export async function HiveFeed({ feed }: { feed: HiveFeedResult }) {
  const t = await getTranslations("hiveFeed");
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>

      <div className="mt-6 space-y-4">
        {feed.status === "unconfigured" && (
          <Alert>
            <AlertDescription>{t("unconfigured")}</AlertDescription>
          </Alert>
        )}
        {feed.status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{t("error")}</AlertDescription>
          </Alert>
        )}
        {feed.status === "ok" && feed.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {feed.status === "ok" && feed.entries.map((e) => <HiveEntry key={e.id} entry={e} />)}
      </div>
    </div>
  );
}
