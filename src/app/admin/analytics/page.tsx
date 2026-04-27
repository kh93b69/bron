import { redirect } from "next/navigation";
import { requireCurrentClub } from "@/server/clubs/current";
import { loadAnalytics, rangeLast } from "@/server/analytics/aggregate";
import { AnalyticsView } from "./_components/analytics-view";

export const dynamic = "force-dynamic";

type Search = { range?: string };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { club, role } = await requireCurrentClub();
  if (role !== "owner") redirect("/admin");

  const { range: rangeRaw } = await searchParams;
  const days = rangeRaw === "7" || rangeRaw === "30" || rangeRaw === "90" ? Number(rangeRaw) : 30;
  const range = rangeLast(days);

  const data = await loadAnalytics(club.id, range);

  return <AnalyticsView analytics={data} days={days} />;
}
