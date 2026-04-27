"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarRange, Coins, Flame, ListChecks, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTenge } from "@/lib/utils";
import type { Analytics } from "@/server/analytics/aggregate";

const RANGES = [
  { v: 7, label: "7 дней" },
  { v: 30, label: "30 дней" },
  { v: 90, label: "90 дней" },
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function AnalyticsView({ analytics, days }: { analytics: Analytics; days: number }) {
  const sp = useSearchParams();
  const a = analytics;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Аналитика</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Загрузка зала, выручка, поведение клиентов за выбранный период
          </p>
        </div>
        <div className="flex gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-bg-elev)] p-1">
          {RANGES.map((r) => (
            <Link
              key={r.v}
              href={`/admin/analytics?range=${r.v}`}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition ${
                days === r.v
                  ? "bg-[var(--color-brand-500)] text-white"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elev-2)]"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<ListChecks className="h-5 w-5" />}
          label="Броней"
          value={String(a.totals.bookings)}
          tone="brand"
        />
        <Stat
          icon={<Coins className="h-5 w-5" />}
          label="Выручка"
          value={formatTenge(a.totals.revenue)}
          hint={`Средний чек ${formatTenge(a.totals.avgCheck)}`}
          tone="warning"
        />
        <Stat
          icon={<Users className="h-5 w-5" />}
          label="Уникальных гостей"
          value={String(a.totals.uniqueGuests)}
          tone="info"
        />
        <Stat
          icon={<CalendarRange className="h-5 w-5" />}
          label="Доходимость"
          value={`${Math.round(a.totals.completionRate * 100)}%`}
          hint="доля completed от всех"
          tone="success"
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-[var(--color-brand-400)]" />
            Выручка по дням
          </CardTitle>
          <CardDescription>
            Сумма всех confirmed/checked_in/completed броней за период
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={a.revenueByDay} />
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[var(--color-brand-400)]" />
            Heatmap загрузки
          </CardTitle>
          <CardDescription>
            Цвет ячейки — % занятых ПК в этот час дня недели. Самые горячие — фиолетовые.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap data={a.occupancyHeatmap} />
        </CardContent>
      </Card>

      {/* Top stations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[var(--color-brand-400)]" />
            Топ ПК по выручке
          </CardTitle>
          <CardDescription>
            Те, что внизу — кандидаты на «горящие места» / обновление железа
          </CardDescription>
        </CardHeader>
        <CardContent>
          {a.topStations.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-2">
              {a.topStations.map((s, i) => {
                const max = a.topStations[0]?.revenue || 1;
                const pct = (s.revenue / max) * 100;
                return (
                  <li key={s.station_id} className="flex items-center gap-3">
                    <span className="w-6 text-right font-mono text-xs text-[var(--color-fg-subtle)]">
                      {i + 1}
                    </span>
                    <span className="w-20 truncate text-sm font-medium">{s.name}</span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-bg-elev-2)]">
                      <div
                        className="absolute inset-y-0 left-0 gradient-brand"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex h-full items-center justify-between px-3 text-xs">
                        <span className="font-medium">{s.count} броней</span>
                        <span className="text-[var(--color-fg-muted)]">
                          {formatTenge(s.revenue)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Status breakdown */}
      {Object.keys(a.statusBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Статусы броней</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(a.statusBreakdown).map(([k, v]) => (
                <Badge key={k} variant={statusVariant(k)} className="text-sm">
                  {statusLabel(k)}: {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "brand" | "success" | "warning" | "info";
}) {
  const map: Record<typeof tone, string> = {
    brand: "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]",
    success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    info: "bg-[var(--color-info)]/15 text-[var(--color-info)]",
  };
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${map[tone]}`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-[var(--color-fg-muted)]">{label}</span>
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {hint && <span className="text-[11px] text-[var(--color-fg-subtle)]">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ data }: { data: Array<{ date: string; revenue: number; bookings: number }> }) {
  if (data.length === 0) return <EmptyState />;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const total = data.reduce((s, d) => s + d.revenue, 0);
  if (total === 0) return <EmptyState text="За период нет броней" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-44 items-end gap-0.5">
        {data.map((d) => {
          const h = (d.revenue / max) * 100;
          return (
            <div
              key={d.date}
              title={`${formatDate(d.date)} · ${formatTenge(d.revenue)} · ${d.bookings} броней`}
              className="group relative flex-1 cursor-default"
            >
              <div
                className="w-full rounded-t-sm gradient-brand transition-all group-hover:opacity-80"
                style={{ height: `${Math.max(h, 0.5)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-fg-subtle)]">
        <span>{formatDate(data[0]?.date ?? "")}</span>
        <span>{formatDate(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}

function Heatmap({ data }: { data: number[][] }) {
  // 7 строк (дни), 24 столбца (часы)
  const max = Math.max(...data.flat(), 0.001);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* hours header */}
        <div className="ml-10 grid grid-cols-24 gap-px text-[9px] text-[var(--color-fg-subtle)]" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center">
              {h}
            </div>
          ))}
        </div>
        {/* rows */}
        <div className="mt-1 flex flex-col gap-px">
          {data.map((row, wd) => (
            <div key={wd} className="flex items-center gap-1">
              <span className="w-9 shrink-0 text-right text-[10px] font-medium text-[var(--color-fg-muted)]">
                {WEEKDAYS[wd]}
              </span>
              <div
                className="grid flex-1 gap-px"
                style={{ gridTemplateColumns: "repeat(24, 1fr)" }}
              >
                {row.map((v, h) => {
                  const opacity = max > 0 ? v / max : 0;
                  return (
                    <div
                      key={h}
                      title={`${WEEKDAYS[wd]} ${h}:00 — ${Math.round(v * 100)}% занят`}
                      className="aspect-square rounded-sm"
                      style={{
                        backgroundColor: `hsl(290 65% 58% / ${opacity * 0.9 + 0.05})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
          <span>0%</span>
          <div
            className="h-2 flex-1 rounded-full"
            style={{
              background: `linear-gradient(to right, hsl(290 65% 58% / 0.05), hsl(290 65% 58% / 0.95))`,
            }}
          />
          <span>{Math.round(max * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text = "Пока нет данных за этот период" }: { text?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
      {text}
    </div>
  );
}

function statusVariant(k: string): "info" | "success" | "warning" | "danger" | "default" {
  if (k === "completed" || k === "checked_in") return "success";
  if (k === "confirmed") return "info";
  if (k === "pending") return "warning";
  if (k === "no_show") return "danger";
  return "default";
}
function statusLabel(k: string) {
  return (
    {
      pending: "Ожидание",
      confirmed: "Подтверждена",
      checked_in: "В игре",
      completed: "Завершена",
      cancelled: "Отменена",
      no_show: "No-show",
    }[k] ?? k
  );
}
function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}`;
}
