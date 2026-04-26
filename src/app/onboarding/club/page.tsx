"use client";

import { useState } from "react";
import { Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo";

export default function ClubOnboardingPage() {
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
    window.location.assign("/admin");
  }

  function upd<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, var(--color-brand-500), transparent 70%)",
        }}
      />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 sm:py-16">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark />
          <span className="text-sm text-[var(--color-fg-muted)]">CyberBook · онбординг</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Создаём <span className="gradient-text">твой клуб</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Заполни минимум, остальное настроишь в админке.
        </p>

        <Card className="mt-8 animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[var(--color-brand-400)]" />
              Базовая информация
            </CardTitle>
            <CardDescription>
              Эти данные увидят геймеры на витрине и в email-уведомлениях
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Название клуба">
                <Input
                  required
                  value={form.name}
                  onChange={(e) => upd("name", e.target.value)}
                  placeholder="Colizeum Almaty Abay"
                />
              </Field>
              <Field
                label="URL-адрес (slug)"
                hint="латиница, цифры, дефисы. Ссылка получится /c/<slug>"
              >
                <Input
                  required
                  pattern="[a-z0-9][a-z0-9-]{2,50}"
                  value={form.slug}
                  onChange={(e) => upd("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="colizeum-abay"
                  className="font-mono"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Город">
                  <Input
                    required
                    value={form.city}
                    onChange={(e) => upd("city", e.target.value)}
                  />
                </Field>
                <Field label="Телефон для клиентов">
                  <Input
                    required
                    type="tel"
                    value={form.contact_phone}
                    onChange={(e) => upd("contact_phone", e.target.value)}
                    placeholder="+77011234567"
                  />
                </Field>
              </div>
              <Field label="Адрес">
                <Input
                  required
                  value={form.address}
                  onChange={(e) => upd("address", e.target.value)}
                  placeholder="ул. Абая, 150, 3 этаж"
                />
              </Field>
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

              <Button
                type="submit"
                size="lg"
                loading={loading}
                disabled={!form.name || !form.slug || !form.address}
                className="mt-2"
              >
                <Sparkles className="h-4 w-4" />
                Создать клуб
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
