"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Stage = "email" | "code" | "success";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/";

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Код отправлен на почту");
    setStage("code");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (error) {
      toast.error("Неверный или просроченный код");
      return;
    }
    setStage("success");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-border p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-700)]">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Вход в CyberBook</h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              По коду из email — без пароля
            </p>
          </div>
        </div>

        {stage === "email" && (
          <form onSubmit={sendOtp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span>Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="you@example.com"
                className="rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !email}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Получить код
            </button>
          </form>
        )}

        {stage === "code" && (
          <form onSubmit={verifyOtp} className="flex flex-col gap-3">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Мы отправили 6-значный код на <span className="font-medium">{email}</span>.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span>Код из письма</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6,10}"
                maxLength={10}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="rounded-md border border-border bg-background px-3 py-3 text-center text-xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Войти
            </button>
            <button
              type="button"
              onClick={() => setStage("email")}
              className="text-xs text-[color:var(--muted-foreground)] hover:underline"
            >
              Поменять email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
