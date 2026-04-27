"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatTenge } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Zone = {
  id: string;
  name: string;
  color: string;
  price_per_hour: number;
  sort_order: number;
  description: string | null;
};

const PRESET_COLORS = [
  "#F59E0B", // amber (VIP)
  "#6366F1", // indigo (Bootcamp)
  "#10B981", // emerald (General)
  "#EF4444", // red
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#84CC16", // lime
];

export function ZonesManager({ clubId, initial }: { clubId: string; initial: Zone[] }) {
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>(initial);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Зоны и тарифы</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Разбей зал на VIP / Bootcamp / General — назначь цвет и цену в час
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Зона
        </Button>
      </header>

      {zones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elev-2)] text-[var(--color-fg-muted)]">
              <Plus className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Зоны ещё не настроены</h3>
            <p className="max-w-md text-sm text-[var(--color-fg-muted)]">
              Создай хотя бы одну зону, чтобы потом привязать к ней ПК. Минимум — общая зона
              «General», максимум — сколько хочешь
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Создать первую зону
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => (
            <Card key={z.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-7 w-7 shrink-0 rounded-md"
                      style={{ backgroundColor: z.color }}
                    />
                    <div>
                      <div className="font-semibold">{z.name}</div>
                      <div className="text-xs text-[var(--color-fg-muted)]">
                        {formatTenge(z.price_per_hour)}/ч
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(z)} aria-label="Редактировать">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingId(z.id)}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                    </Button>
                  </div>
                </div>
                {z.description && (
                  <p className="text-xs text-[var(--color-fg-muted)] line-clamp-2">
                    {z.description}
                  </p>
                )}
                <Badge variant="outline" className="w-fit">
                  Порядок: {z.sort_order}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <ZoneFormDialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setCreating(false);
              setEditing(null);
            }
          }}
          clubId={clubId}
          initial={editing ?? undefined}
          onSaved={(saved) => {
            setZones((prev) => upsertById(prev, saved));
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title="Удалить зону?"
        description="Если к зоне привязаны ПК — удалить нельзя. Сначала перенеси ПК в другую зону."
        confirmLabel="Удалить"
        onConfirm={async () => {
          if (!deletingId) return;
          const supabase = createClient();
          const { error } = await supabase.from("zones").delete().eq("id", deletingId);
          if (error) {
            toast.error(error.message);
            throw error;
          }
          setZones((prev) => prev.filter((z) => z.id !== deletingId));
          setDeletingId(null);
          toast.success("Зона удалена");
          refresh();
        }}
      />
    </div>
  );
}

function ZoneFormDialog({
  open,
  onOpenChange,
  clubId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubId: string;
  initial?: Zone;
  onSaved: (z: Zone) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[2]);
  const [price, setPrice] = useState(String(initial?.price_per_hour ?? 1500));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const payload = {
      club_id: clubId,
      name: name.trim(),
      color,
      price_per_hour: Math.max(1, Math.round(Number(price) || 0)),
      description: description.trim() || null,
      sort_order: Math.round(Number(sortOrder) || 0),
    };

    let result;
    if (isEdit && initial) {
      result = await supabase
        .from("zones")
        .update(payload)
        .eq("id", initial.id)
        .select()
        .single();
    } else {
      result = await supabase.from("zones").insert(payload).select().single();
    }
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isEdit ? "Зона обновлена" : "Зона создана");
    onSaved(result.data as Zone);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEdit ? "Редактировать зону" : "Новая зона"}
        description={isEdit ? initial?.name : "Например: VIP, Bootcamp, General"}
        onClose={() => onOpenChange(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button form="zone-form" type="submit" loading={loading} disabled={!name.trim() || !price}>
              {isEdit ? "Сохранить" : "Создать"}
            </Button>
          </>
        }
      >
        <form id="zone-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Название">
            <Input
              required
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VIP"
              autoFocus
            />
          </Field>

          <div>
            <Label>Цвет на карте</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-md transition ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-[var(--color-bg-elev)]"
                      : "ring-0"
                  }`}
                  style={{ backgroundColor: c, ["--ring-color" as string]: c }}
                  aria-label={`Цвет ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Свой цвет"
                className="h-8 w-8 cursor-pointer rounded-md border border-[var(--color-border-strong)] bg-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Цена (₸ в час)" hint="Целое число тенге">
              <Input
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field label="Порядок" hint="Чем меньше — тем выше в списке">
              <Input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Описание (опционально)">
            <Textarea
              rows={2}
              maxLength={200}
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Игровые кресла, изолированная комната, RTX 4090…"
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}
