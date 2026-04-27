"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, Grid3x3, Plus, Save, Tag, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Station = {
  id: string;
  name: string;
  zone_id: string;
  position_x: number;
  position_y: number;
  status: "active" | "maintenance" | "retired";
};
type Zone = { id: string; name: string; color: string };
type LabelItem = { id: string; x: number; y: number; text: string };
type Layout = {
  gridW: number;
  gridH: number;
  cellSize?: number;
  labels?: LabelItem[];
};

const DEFAULT_LAYOUT: Layout = { gridW: 20, gridH: 15, cellSize: 36, labels: [] };

export function MapEditor({
  clubId,
  clubSlug,
  stations: initialStations,
  zones,
  layout: initialLayout,
  version: initialVersion,
}: {
  clubId: string;
  clubSlug: string;
  stations: Station[];
  zones: Zone[];
  layout: Layout | null;
  version: number;
}) {
  const [stations, setStations] = useState(initialStations);
  const [layout, setLayout] = useState<Layout>(() => ({
    ...DEFAULT_LAYOUT,
    ...(initialLayout ?? {}),
    labels: initialLayout?.labels ?? [],
  }));
  const [version] = useState(initialVersion);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const cell = 36;
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; offX: number; offY: number } | null>(null);

  function clampPos(x: number, y: number) {
    return {
      x: Math.max(0, Math.min(layout.gridW - 1, x)),
      y: Math.max(0, Math.min(layout.gridH - 1, y)),
    };
  }

  // Drag-n-drop стейшенов через native pointer events (поддерживает touch + mouse)
  function onPointerDown(e: React.PointerEvent, st: Station) {
    if (st.status === "retired") return;
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: st.id,
      startX: e.clientX,
      startY: e.clientY,
      offX: st.position_x,
      offY: st.position_y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !containerRef.current) return;
    const drag = dragRef.current;
    const dx = (e.clientX - drag.startX) / (cell * zoom);
    const dy = (e.clientY - drag.startY) / (cell * zoom);
    const { x, y } = clampPos(Math.round(drag.offX + dx), Math.round(drag.offY + dy));

    setStations((prev) =>
      prev.map((s) => (s.id === drag.id ? { ...s, position_x: x, position_y: y } : s)),
    );
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    const id = dragRef.current.id;
    dragRef.current = null;
    const moved = stations.find((s) => s.id === id);
    if (!moved) return;
    // мгновенно сохраняем позицию в БД (так что dirty не нужен на станциях)
    saveStationPosition(moved);
  }

  async function saveStationPosition(s: Station) {
    const supabase = createClient();
    const { error } = await supabase
      .from("stations")
      .update({ position_x: s.position_x, position_y: s.position_y })
      .eq("id", s.id);
    if (error) toast.error(`${s.name}: ${error.message}`);
  }

  async function saveLayout() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("club_maps")
      .update({ layout: { ...layout, cellSize: cell }, version: version + 1 })
      .eq("club_id", clubId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDirty(false);
    toast.success("Карта сохранена");
  }

  function setGrid(w: number, h: number) {
    const newW = Math.max(4, Math.min(40, Math.round(w)));
    const newH = Math.max(4, Math.min(40, Math.round(h)));
    setLayout((l) => ({ ...l, gridW: newW, gridH: newH }));
    setDirty(true);
    // Если уменьшили — снап ПК внутрь нового размера
    setStations((prev) =>
      prev.map((s) => ({
        ...s,
        position_x: Math.min(s.position_x, newW - 1),
        position_y: Math.min(s.position_y, newH - 1),
      })),
    );
  }

  function addLabel() {
    const text = prompt("Текст подписи (например, БАР, ВХОД, КУХНЯ)");
    if (!text || !text.trim()) return;
    const id = crypto.randomUUID();
    const labels = layout.labels ?? [];
    setLayout((l) => ({ ...l, labels: [...labels, { id, x: 1, y: 1, text: text.trim() }] }));
    setDirty(true);
  }

  function removeLabel(id: string) {
    setLayout((l) => ({ ...l, labels: (l.labels ?? []).filter((x) => x.id !== id) }));
    setDirty(true);
  }

  function moveLabel(id: string, x: number, y: number) {
    setLayout((l) => ({
      ...l,
      labels: (l.labels ?? []).map((lb) => (lb.id === id ? { ...lb, x, y } : lb)),
    }));
    setDirty(true);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Карта зала</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Перетащи ПК, чтобы расставить как у тебя в зале. Координаты сохраняются автоматически.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/c/${clubSlug}`} target="_blank">
            <Button variant="outline" size="sm">
              <Eye className="h-3.5 w-3.5" /> Превью
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Button>
          </Link>
          <Button size="sm" loading={saving} onClick={saveLayout} disabled={!dirty}>
            <Save className="h-3.5 w-3.5" /> {dirty ? "Сохранить карту" : "Сохранено"}
          </Button>
        </div>
      </header>

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
              <Grid3x3 className="mr-1 inline h-3 w-3" /> Размер сетки
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={4}
                max={40}
                value={layout.gridW}
                onChange={(e) => setGrid(Number(e.target.value), layout.gridH)}
                className="h-9 w-16"
              />
              <span className="text-[var(--color-fg-subtle)]">×</span>
              <Input
                type="number"
                min={4}
                max={40}
                value={layout.gridH}
                onChange={(e) => setGrid(layout.gridW, Number(e.target.value))}
                className="h-9 w-16"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Масштаб
            </span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-12 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="outline" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Button size="sm" variant="outline" onClick={addLabel}>
            <Tag className="h-3.5 w-3.5" /> Подпись
          </Button>

          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <Badge variant="default">{stations.length} ПК</Badge>
            <span>·</span>
            <span>
              {stations.filter((s) => s.status === "active").length} активны
            </span>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <div
            ref={containerRef}
            className="relative mx-auto bg-[var(--color-bg-elev-2)]"
            style={{
              padding: 24,
              width: layout.gridW * cell * zoom + 48,
              minHeight: layout.gridH * cell * zoom + 48,
              userSelect: "none",
              touchAction: "none",
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="relative"
              style={{
                width: layout.gridW * cell,
                height: layout.gridH * cell,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                backgroundImage:
                  "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
                backgroundSize: `${cell}px ${cell}px`,
                backgroundPosition: "-1px -1px",
              }}
            >
              {/* Подписи */}
              {(layout.labels ?? []).map((lb) => (
                <DraggableLabel
                  key={lb.id}
                  label={lb}
                  cell={cell}
                  gridW={layout.gridW}
                  gridH={layout.gridH}
                  onMove={(x, y) => moveLabel(lb.id, x, y)}
                  onRemove={() => removeLabel(lb.id)}
                />
              ))}

              {/* Стейшены */}
              {stations.map((s) => {
                const zone = zoneById.get(s.zone_id);
                const isRetired = s.status === "retired";
                const isMaint = s.status === "maintenance";
                const bg = isRetired
                  ? "hsl(0 0% 30%)"
                  : isMaint
                    ? "hsl(38 70% 50%)"
                    : (zone?.color ?? "hsl(290 65% 58%)");
                return (
                  <div
                    key={s.id}
                    onPointerDown={(e) => onPointerDown(e, s)}
                    title={`${s.name}${zone ? ` · ${zone.name}` : ""}${isMaint ? " (на обслуживании)" : ""}`}
                    style={{
                      position: "absolute",
                      left: s.position_x * cell + 2,
                      top: s.position_y * cell + 2,
                      width: cell - 4,
                      height: cell - 4,
                      backgroundColor: bg,
                      cursor: isRetired ? "not-allowed" : "grab",
                    }}
                    className="flex items-center justify-center rounded-md border-2 border-transparent text-[10px] font-bold text-white shadow-md transition hover:scale-110 hover:border-white"
                  >
                    {s.name.replace(/^[^-]*-/, "") || s.name.slice(0, 3)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] px-4 py-3 text-[11px] text-[var(--color-fg-muted)]">
          <Legend color="hsl(290 65% 58%)" label="Активный ПК" />
          <Legend color="hsl(38 70% 50%)" label="Обслуживание" />
          <Legend color="hsl(0 0% 30%)" label="Списан" />
          <span className="ml-auto text-[var(--color-fg-subtle)]">
            Тяни ПК мышью или пальцем — позиция сохраняется автоматически
          </span>
        </div>
      </Card>

      {stations.length === 0 && (
        <Card className="border-dashed">
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-[var(--color-fg-muted)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elev-2)]">
              <Plus className="h-5 w-5" />
            </div>
            ПК ещё нет — сначала добавь их в разделе{" "}
            <Link href="/admin/stations" className="text-[var(--color-brand-300)] hover:underline">
              «ПК»
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function DraggableLabel({
  label,
  cell,
  gridW,
  gridH,
  onMove,
  onRemove,
}: {
  label: LabelItem;
  cell: number;
  gridW: number;
  gridH: number;
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const drag = useRef<{ startX: number; startY: number; offX: number; offY: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, offX: label.x, offY: label.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.startX) / cell;
    const dy = (e.clientY - drag.current.startY) / cell;
    const x = Math.max(0, Math.min(gridW - 2, Math.round(drag.current.offX + dx)));
    const y = Math.max(0, Math.min(gridH - 1, Math.round(drag.current.offY + dy)));
    onMove(x, y);
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        left: label.x * cell + 4,
        top: label.y * cell + 4,
        cursor: "move",
        touchAction: "none",
      }}
      className="group flex items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-fg-muted)] shadow-md hover:border-[var(--color-brand-500)]"
    >
      {label.text}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 transition group-hover:opacity-100"
        aria-label="Удалить подпись"
      >
        <Trash2 className="h-3 w-3 text-[var(--color-danger)]" />
      </button>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
