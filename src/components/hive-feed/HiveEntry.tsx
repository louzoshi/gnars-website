"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, MessageCircle, ThumbsUp } from "lucide-react";
import { Markdown } from "@/components/common/Markdown";
import { AddressDisplay } from "@/components/ui/address-display";
import { Button } from "@/components/ui/button";
import { hiveAvatarUrl, hiveEntryUrl, normalizeHiveBody } from "@/lib/hive/body";
import type { HiveFeedAuthor, HiveFeedEntry } from "@/lib/hive/discussion";
import { getDateFnsLocale } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

function Author({ author }: { author: HiveFeedAuthor }) {
  if (author.kind === "member") {
    return (
      <AddressDisplay address={author.address} variant="compact" avatarSize="sm" showCopy={false} />
    );
  }
  return (
    <a
      href={`https://peakd.com/@${author.account}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-center gap-2 text-sm font-medium hover:underline"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hiveAvatarUrl(author.account)}
        alt=""
        className="size-6 shrink-0 rounded-full bg-muted"
      />
      <span className="truncate">@{author.account}</span>
    </a>
  );
}

/** One post or reply, with its thread. Depth only changes spacing; threads stay readable at 320 px. */
export function HiveEntry({ entry, depth = 0 }: { entry: HiveFeedEntry; depth?: number }) {
  const t = useTranslations("hiveFeed");
  const locale = useLocale();
  const [open, setOpen] = useState(depth > 0);
  const when = formatDistanceToNow(new Date(entry.createdAt), {
    addSuffix: true,
    locale: getDateFnsLocale(locale),
  });

  return (
    <article className={cn("min-w-0", depth === 0 ? "rounded-lg border bg-card p-4" : "pt-3")}>
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Author author={entry.author} />
        <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">
          {when}
          {entry.edited && ` · ${t("edited")}`}
        </time>
      </header>

      <Markdown allowHtml className="prose-sm mt-2 max-w-none break-words">
        {normalizeHiveBody(entry.body)}
      </Markdown>

      <footer className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="size-3.5" aria-hidden />
          {t("votes", { count: entry.votes })}
        </span>
        {entry.replies.length > 0 && depth === 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 cursor-pointer gap-1 px-2 text-xs"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <MessageCircle className="size-3.5" aria-hidden />
            {open ? t("hideReplies") : `${t("showReplies")} (${entry.replyCount})`}
          </Button>
        ) : (
          entry.replyCount > 0 &&
          depth === 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden />
              {t("replies", { count: entry.replyCount })}
            </span>
          )
        )}
        <a
          href={hiveEntryUrl(entry.hiveAuthor, entry.permlink)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
        >
          {t("viewOnHive")}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </footer>

      {open && entry.replies.length > 0 && (
        <div className={cn("mt-1 border-l pl-3", depth < 3 && "sm:pl-4")}>
          {entry.replies.map((r) => (
            <HiveEntry key={r.id} entry={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </article>
  );
}
