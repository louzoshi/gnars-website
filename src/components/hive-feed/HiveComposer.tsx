"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useConnectModal } from "thirdweb/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHivePublish } from "@/hooks/use-hive-publish";
import { usePinataUpload } from "@/hooks/use-pinata-upload";
import { useUserAddress } from "@/hooks/use-user-address";
import { HIVE_BODY_MAX } from "@/lib/hive/publish";
import { getThirdwebClient } from "@/lib/thirdweb";
import { THIRDWEB_AA_CONFIG, THIRDWEB_WALLETS } from "@/lib/thirdweb-wallets";

interface HiveComposerProps {
  /** Reply target; omitted for a new post. */
  parent?: { author: string; permlink: string };
  onDone?: () => void;
  autoFocus?: boolean;
}

/** Bodies go to Hive as markdown; the attached image rides along as a markdown image. */
export function HiveComposer({ parent, onDone, autoFocus }: HiveComposerProps) {
  const t = useTranslations("hiveFeed");
  const router = useRouter();
  const { isConnected } = useUserAddress();
  const { publish, canSign } = useHivePublish();
  const upload = usePinataUpload();
  const { connect } = useConnectModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const body = [text.trim(), image ? `![](${image})` : ""].filter(Boolean).join("\n\n");
  const left = HIVE_BODY_MAX - body.length;
  const canPost = body.length > 0 && left >= 0 && !uploading && !posting;

  const login = useCallback(async () => {
    const client = getThirdwebClient();
    if (!client) return;
    try {
      await connect({
        client,
        wallets: THIRDWEB_WALLETS,
        accountAbstraction: THIRDWEB_AA_CONFIG,
        size: "compact",
        title: t("composer.loginTitle"),
      });
    } catch {
      // closed the modal
    }
  }, [connect, t]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const res = await upload(file);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.success && res.data) setImage(res.data.gatewayUrl);
    else if (!res.cancelled) toast.error(t("composer.uploadFailed"));
  };

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    const res = await publish(parent ? { kind: "comment", parent, body } : { kind: "post", body });
    setPosting(false);
    if (!res.ok) {
      toast.error(t(`errors.${res.error}`));
      return;
    }
    toast.success(res.dryRun ? t("composer.dryRun") : t("composer.posted"));
    if (res.dryRun) return;
    setText("");
    setImage(null);
    onDone?.();
    // Hive's API indexes a new entry a few seconds after its block.
    setTimeout(() => router.refresh(), 4000);
  };

  if (!isConnected || !canSign) {
    return (
      <Button
        onClick={login}
        size={parent ? "sm" : "default"}
        variant={parent ? "outline" : "default"}
        className={parent ? "mt-2 cursor-pointer" : "w-full cursor-pointer sm:w-auto"}
      >
        {t("composer.login")}
      </Button>
    );
  }

  return (
    <div className={parent ? "mt-2 space-y-2" : "space-y-2 rounded-lg border bg-card p-3"}>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={parent ? t("composer.replyPlaceholder") : t("composer.placeholder")}
        rows={parent ? 2 : 3}
        autoFocus={autoFocus}
        maxLength={HIVE_BODY_MAX}
        className="resize-y text-base sm:text-sm"
      />
      {image && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="max-h-40 rounded-md border" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t("composer.removeImage")}
            className="absolute right-1 top-1 size-7 cursor-pointer"
            onClick={() => setImage(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1"
          disabled={uploading || posting}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          <span className="sr-only sm:not-sr-only">
            {uploading ? t("composer.uploading") : t("composer.addImage")}
          </span>
        </Button>
        {left < 200 && (
          <span className={left < 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {t("composer.charsLeft", { count: left })}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {parent && onDone && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer"
              onClick={onDone}
            >
              {t("composer.cancel")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={!canPost}
            onClick={submit}
          >
            {posting && <Loader2 className="size-4 animate-spin" />}
            {posting ? t("composer.posting") : parent ? t("composer.reply") : t("composer.post")}
          </Button>
        </div>
      </div>
    </div>
  );
}
