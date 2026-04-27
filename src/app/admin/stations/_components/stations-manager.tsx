"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Monitor, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Station = {
  id: string;
  zone_id: string;
  name: string;
  position_x: number;
  position_y: number;
  status: "active" | "maintenance" | "retired";
  specs: Record<string, unknown> | null;
};
type Zone = { id: string; name: string; color: string; price_per_hour: number; sort_order: number };

const STATUS_LABEL: Record<Station["status"], string> = {
  active: "Активен",
  maintenance: "Обслуживание",
  retired: "Списан",
};
const STATUS_VARIANT: Record<Station["status"], "success" | "warning" | "default"> = {
  active: "success",
  maintenance: "warning",
  retired: "default",
};

export function StationsManager({
  clubId,
  initialStations,
  zones,
}: {
  clubId: string;
  initialStations: Station[];
  zones: Zone[];
}) {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>(initialStations);
  const [zoneFilter, setZoneFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [editing, setEditing] = useState<Station | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const filtered = stations.filter((s) => {
    if (zoneFilter && s.zone_id !== zoneFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ПК</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            {stations.length} компьютеров · {stations.filter((s) => s.status === "active").length} активны
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={zones.length === 0}>
          <Plus className="h-4 w-4" /> ПК
        </Button>
      </header>

      {zones.length === 0 && (
        <Card className="border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="warning">Сначала создай зону</Badge>
              <p className="mt-2 text-sm">
                Каждый ПК привязан к зоне (VIP / Bootcamp / General). Создай хотя бы одну зону.
              </p>
            </div>
            <Link href="/admin/zones">
              <Button variant="outline">К зонам</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {zones.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="flex items-center gap-1">
                <Filter className="h-3 w-3" /> Зона
              </Label>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
              >
                <option value="">Все зоны</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Статус</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
              >
                <option value="">Все</option>
                <option value="active">Активные</option>
                <option value="maintenance">На обслуживании</option>
                <option value="retired">Списаны</option>
              </select>
            </div>
            {(zoneFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setZoneFilter("");
                  setStatusFilter("");
                }}
              >
                Сбросить
              </Button>
            )}
            <span className="ml-auto text-xs text-[var(--color-fg-subtle)]">
              {filtered.length} из {stations.length}
            </span>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elev-2)] text-[var(--color-fg-muted)]">
              <Monitor className="h-5 w-5" />
            </div>
            {stations.length === 0 ? (
              <>
                <h3 className="text-base font-semibold">Пока нет ПК</h3>
                <p className="max-w-md text-sm text-[var(--color-fg-muted)]">
                  Добавь первый ПК — задай имя, привяжи к зоне, укажи характеристики
                </p>
                {zones.length > 0 && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Добавить ПК
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-fg-muted)]">Нет ПК под этот фильтр</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-elev-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                <tr>
                  <Th>Имя</Th>
                  <Th>Зона</Th>
                  <Th>Спецификация</Th>
                  <Th>Координаты</Th>
                  <Th>Статус</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((s) => {
                  const zone = zoneById.get(s.zone_id);
                  const specs = s.specs as Record<string, unknown> | null;
                  return (
                    <tr key={s.id} className="transition hover:bg-[var(--color-bg-elev-2)]/50">
                      <Td>
                        <div className="font-medium">{s.name}</div>
                      </Td>
                      <Td>
                        {zone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: zone.color }}
                            />
                            {zone.name}
                          </span>
                        ) : (
                          <span className="text-[var(--color-fg-subtle)]">—</span>
                        )}
                      </Td>
                      <Td className="text-xs text-[var(--color-fg-muted)]">
                        {specsLabel(specs)}
                      </Td>
                      <Td className="font-mono text-xs">
                        ({s.position_x}, {s.position_y})
                      </Td>
                      <Td>
                        <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label="Редактировать">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingId(s.id)}
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(creating || editing) && (
        <StationFormDialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setCreating(false);
              setEditing(null);
            }
          }}
          clubId={clubId}
          zones={zones}
          initial={editing ?? undefined}
          existingNames={stations.map((s) => s.name)}
          onSaved={(s) => {
            setStations((prev) => upsertById(prev, s));
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Удалить ПК?"
        description="Если на ПК есть будущие брони — удаление будет заблокировано. Альтернатива: пометить как «Списан»."
        confirmLabel="Удалить"
        onConfirm={async () => {
          if (!deletingId) return;
          const supabase = createClient();
          const { error } = await supabase.from("stations").delete().eq("id", deletingId);
          if (error) {
            toast.error(error.message);
            throw error;
          }
          setStations((prev) => prev.filter((s) => s.id !== deletingId));
          toast.success("ПК удалён");
          router.refresh();
        }}
      />
    </div>
  );
}

function StationFormDialog({
  open,
  onOpenChange,
  clubId,
  zones,
  initial,
  existingNames,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubId: string;
  zones: Zone[];
  initial?: Station;
  existingNames: string[];
  onSaved: (s: Station) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [zoneId, setZoneId] = useState(initial?.zone_id ?? zones[0]?.id ?? "");
  const [posX, setPosX] = useState(String(initial?.position_x ?? 0));
  const [posY, setPosY] = useState(String(initial?.position_y ?? 0));
  const [status, setStatus] = useState<Station["status"]>(initial?.status ?? "active");
  const [cpu, setCpu] = useState(((initial?.specs as Record<string, string>) ?? {})["cpu"] ?? "");
  const [gpu, setGpu] = useState(((initial?.specs as Record<string, string>) ?? {})["gpu"] ?? "");
  const [ram, setRam] = useState(((initial?.specs as Record<string, string>) ?? {})["ram_gb"] ?? "");
  const [hz, setHz] = useState(((initial?.specs as Record<string, string>) ?? {})["monitor_hz"] ?? "");
  const [loading, setLoading] = useState(false);

  const nameClash = !isEdit && existingNames.includes(name.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId) return;
    setLoading(true);

    const specs: Record<string, unknown> = {};
    if (cpu) specs.cpu = cpu;
    if (gpu) specs.gpu = gpu;
    if (ram) specs.ram_gb = Number(ram) || ram;
    if (hz) specs.monitor_hz = Number(hz) || hz;

    const payload = {
      club_id: clubId,
      zone_id: zoneId,
      name: name.trim(),
      position_x: Math.max(0, Math.min(39, Math.round(Number(posX) || 0))),
      position_y: Math.max(0, Math.min(39, Math.round(Number(posY) || 0))),
      status,
      specs,
    };

    const supabase = createClient();
    let result;
    if (isEdit && initial) {
      result = await supabase.from("stations").update(payload).eq("id", initial.id).select().single();
    } else {
      result = await supabase.from("stations").insert(payload).select().single();
    }
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isEdit ? "ПК обновлён" : "ПК создан");
    onSaved(result.data as Station);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Редактировать ПК" : "Новый ПК"}
        description={isEdit ? initial?.name : "Уникальное имя в пределах клуба"}
        onClose={() => onOpenChange(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button form="station-form" type="submit" loading={loading} disabled={!name.trim() || !zoneId || nameClash}>
              {isEdit ? "Сохранить" : "Создать"}
            </Button>
          </>
        }
      >
        <form id="station-form" onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Имя ПК"
              error={nameClash ? "Уже есть ПК с таким именем" : undefined}
            >
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VIP-1"
                autoFocus
              />
            </Field>
            <Field label="Зона">
              <select
                required
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-3 text-sm"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <Label>Характеристики (опционально)</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Input value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="CPU: i7-13700" />
              <Input value={gpu} onChange={(e) => setGpu(e.target.value)} placeholder="GPU: RTX 4070" />
              <Input
                value={ram}
                onChange={(e) => setRam(e.target.value)}
                placeholder="RAM: 32 GB"
              />
              <Input
                value={hz}
                onChange={(e) => setHz(e.target.value)}
                placeholder="Монитор: 240 Hz"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="X на карте" hint="0–39">
              <Input
                type="number"
                min={0}
                max={39}
                value={posX}
                onChange={(e) => setPosX(e.target.value)}
              />
            </Field>
            <Field label="Y на карте" hint="0–39">
              <Input
                type="number"
                min={0}
                max={39}
                value={posY}
                onChange={(e) => setPosY(e.target.value)}
              />
            </Field>
            <Field label="Статус">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Station["status"])}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-3 text-sm"
              >
                <option value="active">Активен</option>
                <option value="maintenance">На обслуживании</option>
                <option value="retired">Списан</option>
              </select>
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function specsLabel(specs: Record<string, unknown> | null) {
  if (!specs) return "—";
  const parts: string[] = [];
  if (specs.cpu) parts.push(String(specs.cpu));
  if (specs.gpu) parts.push(String(specs.gpu));
  if (specs.monitor_hz) parts.push(`${specs.monitor_hz} Hz`);
  return parts.length ? parts.join(" · ") : "—";
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const next = list.slice();
  next[i] = item;
  return next;
}
