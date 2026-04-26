"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo";

type Stage = "email" | "code";

export function LoginForm() {
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
    toast.success("Код отправлен");
    setStage("code");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Неверный или просроченный код");
      return;
    }

    let destination = redirectTo;
    if (redirectTo === "/") {
      const { data: memberships } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", data.user.id)
        .limit(1);
      destination = memberships && memberships.length > 0 ? "/admin" : "/onboarding/club";
    }

    window.location.assign(destination);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="mb-2 flex items-center gap-3">
          <LogoMark />
          <div className="flex flex-col">
            <CardTitle className="text-lg">Вход в CyberBook</CardTitle>
            <CardDescription className="text-xs">
              По коду из email — без пароля
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {stage === "email" && (
          <form onSubmit={sendOtp} className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="you@example.com"
              />
            </Field>
            <Button type="submit" disabled={!email} loading={loading}>
              <Mail className="h-4 w-4" />
              Получить код
            </Button>
          </form>
        )}

        {stage === "code" && (
          <form onSubmit={verifyOtp} className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-3 text-xs text-[var(--color-fg-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-400)]" />
              <span>
                Мы отправили код на <span className="font-semibold text-[var(--color-fg)]">{email}</span>.
                Письмо может попасть в «Промоакции» / «Спам».
              </span>
            </div>
            <Field label="Код из письма">
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{6,10}"
                maxLength={10}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-center text-2xl tracking-[0.4em] font-mono"
              />
            </Field>
            <Button type="submit" disabled={code.length < 6} loading={loading}>
              Войти
            </Button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
              }}
              className="inline-flex items-center justify-center gap-1.5 text-xs text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
            >
              <ArrowLeft className="h-3 w-3" />
              Поменять email
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
