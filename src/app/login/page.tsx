import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "./_login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <Loader2 className="h-6 w-6 animate-spin text-[color:var(--muted-foreground)]" />
    </main>
  );
}
