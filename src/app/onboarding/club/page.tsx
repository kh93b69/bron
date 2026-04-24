"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function ClubOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    city: "Алматы",
    address: "",
    contact_phone: "",
    open_time: "12:00",
    close_time: "04:00",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_club_with_owner", {
      p_name: form.name,
      p_slug: form.slug,
      p_city: form.city,
      p_address: form.address,
      p_contact_phone: form.contact_phone,
      p_open_time: form.open_time,
      p_close_time: form.close_time,
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Клуб создан");
    router.push("/admin");
    router.refresh();
  }

  function upd<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-10">
      <h1 className="text-2xl font-bold">Создаём твой клуб</h1>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        Заполни минимум, остальное настроишь в админке.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <Field label="Название клуба">
          <input
            required
            value={form.name}
            onChange={(e) => upd("name", e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            placeholder="Colizeum Almaty Abay"
          />
        </Field>
        <Field label="URL-адрес (slug)" hint="латиница, цифры, дефисы. /c/<slug>">
          <input
            required
            pattern="[a-z0-9][a-z0-9-]{2,50}"
            value={form.slug}
            onChange={(e) => upd("slug", e.target.value.toLowerCase())}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono"
            placeholder="colizeum-abay"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Город">
            <input
              required
              value={form.city}
              onChange={(e) => upd("city", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </Field>
          <Field label="Телефон для клиентов">
            <input
              required
              type="tel"
              value={form.contact_phone}
              onChange={(e) => upd("contact_phone", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="+77011234567"
            />
          </Field>
        </div>
        <Field label="Адрес">
          <input
            required
            value={form.address}
            onChange={(e) => upd("address", e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            placeholder="ул. Абая, 150, 3 этаж"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Открытие">
            <input
              type="time"
              value={form.open_time}
              onChange={(e) => upd("open_time", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </Field>
          <Field label="Закрытие">
            <input
              type="time"
              value={form.close_time}
              onChange={(e) => upd("close_time", e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Создать клуб
        </button>
      </form>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs text-[color:var(--muted-foreground)]">{hint}</span>}
    </label>
  );
}
