"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Globe, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Club = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  contact_phone: string;
  instagram: string | null;
  description: string | null;
  timezone: string;
  open_time: string;
  close_time: string;
  logo_url: string | null;
  cover_url: string | null;
  status: string;
  subscription_plan: string;
};

export function ClubSettings({ club, role }: { club: Club; role: "owner" | "admin" }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: club.name,
    city: club.city,
    address: club.address,
    contact_phone: club.contact_phone,
    instagram: club.instagram ?? "",
    description: club.description ?? "",
    open_time: club.open_time?.slice(0, 5) ?? "12:00",
    close_time: club.close_time?.slice(0, 5) ?? "04:00",
    status: club.status,
  });
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(club.logo_url);
  const [cover, setCover] = useState<string | null>(club.cover_url);

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/c/${club.slug}`
    : `/c/${club.slug}`;

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({
        name: form.name,
        city: form.city,
        address: form.address,
        contact_phone: form.contact_phone,
        instagram: form.instagram || null,
        description: form.description || null,
        open_time: form.open_time,
        close_time: form.close_time,
        status: form.status,
      })
      .eq("id", club.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Сохранено");
    router.refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Настройки клуба</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Эти данные видят геймеры на витрине
        </p>
      </header>

      {/* Public link card */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="brand">
              <Globe className="h-3 w-3" /> Публичная ссылка
            </Badge>
            <div className="mt-2 break-all font-mono text-sm">{publicUrl}</div>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Помести в bio Instagram, на стол ресепшена через QR-код
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" /> Копировать
            </Button>
            <Link href={`/c/${club.slug}`} target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3.5 w-3.5" /> Открыть
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Cover + Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[var(--color-brand-400)]" />
            Лого и обложка
          </CardTitle>
          <CardDescription>JPG / PNG / WEBP, до 5 MB</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:gap-6">
          <UploadSlot
            kind="logo"
            clubId={club.id}
            label="Лого"
            current={logo}
            onChange={setLogo}
            hint="Квадрат, минимум 256×256"
            previewClass="h-24 w-24"
          />
          <UploadSlot
            kind="cover"
            clubId={club.id}
            label="Обложка"
            current={cover}
            onChange={setCover}
            hint="3:1 или 4:1, минимум 1200×400"
            previewClass="h-24 w-full max-w-md"
          />
        </CardContent>
      </Card>

      {/* Main form */}
      <form onSubmit={save} className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Название">
              <Input required value={form.name} onChange={(e) => upd("name", e.target.value)} />
            </Field>
            <Field label="Slug" hint="Менять не рекомендуется — ссылки сломаются">
              <Input value={club.slug} disabled className="font-mono" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Город">
                <Input required value={form.city} onChange={(e) => upd("city", e.target.value)} />
              </Field>
              <Field label="Телефон">
                <Input
                  required
                  type="tel"
                  value={form.contact_phone}
                  onChange={(e) => upd("contact_phone", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Адрес">
              <Input required value={form.address} onChange={(e) => upd("address", e.target.value)} />
            </Field>
            <Field
              label="Instagram"
              hint="Полная ссылка, например https://instagram.com/colizeum_almaty"
            >
              <Input
                type="url"
                value={form.instagram}
                onChange={(e) => upd("instagram", e.target.value)}
                placeholder="https://instagram.com/..."
              />
            </Field>
            <Field
              label="Описание"
              hint="Что особенного в клубе. Видно на витрине под названием"
            >
              <Textarea
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={(e) => upd("description", e.target.value)}
                placeholder="VIP-комната с RTX 4090, кофе, дисциплины: CS2, Dota 2, Valorant…"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>График работы</CardTitle>
            <CardDescription>
              Геймеры не смогут забронировать вне этих часов. Закрытие через полночь — это норма
              (например, 12:00 → 04:00 = клуб закрывается в 4 утра следующего дня).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Открытие">
                <Input
                  type="time"
                  value={form.open_time}
                  onChange={(e) => upd("open_time", e.target.value)}
                />
              </Field>
              <Field label="Закрытие">
                <Input
                  type="time"
                  value={form.close_time}
                  onChange={(e) => upd("close_time", e.target.value)}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {role === "owner" && (
          <Card>
            <CardHeader>
              <CardTitle>Статус клуба</CardTitle>
              <CardDescription>
                «На паузе» — витрина видна, но кнопка бронирования отключена
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Field label="Состояние">
                <select
                  value={form.status}
                  onChange={(e) => upd("status", e.target.value)}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] px-3 text-sm"
                >
                  <option value="active">Активен</option>
                  <option value="paused">На паузе</option>
                </select>
              </Field>
            </CardContent>
          </Card>
        )}

        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button type="submit" loading={saving} size="lg">
            Сохранить
          </Button>
        </div>
      </form>
    </div>
  );
}

function UploadSlot({
  kind,
  clubId,
  label,
  current,
  onChange,
  hint,
  previewClass,
}: {
  kind: "logo" | "cover";
  clubId: string;
  label: string;
  current: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
  previewClass?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 MB");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${clubId}/${kind}-${Date.now()}.${ext}`;

    const { error: uplErr } = await supabase.storage
      .from("club-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uplErr) {
      setBusy(false);
      toast.error(uplErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("club-assets").getPublicUrl(path);
    const url = pub.publicUrl;
    const column = kind === "logo" ? "logo_url" : "cover_url";
    const { error: upErr } = await supabase.from("clubs").update({ [column]: url }).eq("id", clubId);
    setBusy(false);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    onChange(url);
    toast.success(`${label} обновлён`);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    const column = kind === "logo" ? "logo_url" : "cover_url";
    const { error } = await supabase.from("clubs").update({ [column]: null }).eq("id", clubId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChange(null);
    toast.success(`${label} удалён`);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <Label>{label}</Label>
      <div
        className={`relative overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] ${previewClass}`}
      >
        {current ? (
          <Image src={current} alt={label} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-fg-subtle)]">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> Загрузить
        </Button>
        {current && (
          <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
          </Button>
        )}
        <input
          type="file"
          ref={inputRef}
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      {hint && <span className="text-xs text-[var(--color-fg-subtle)]">{hint}</span>}
    </div>
  );
}
