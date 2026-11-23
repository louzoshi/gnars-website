import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HiveFeed } from "@/components/hive-feed/HiveFeed";
import { getHiveFeed } from "@/services/hive-feed";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hiveFeed");
  return { title: t("title"), description: t("description") };
}

export default async function HiveFeedPage() {
  return <HiveFeed feed={await getHiveFeed()} />;
}
