import { Suspense } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { LoginForm } from "./_login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md animate-slide-up">
          <Suspense fallback={<Loading />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-fg-muted)]" />
    </div>
  );
}
