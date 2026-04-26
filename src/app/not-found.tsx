import Link from "next/link";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-elev)] text-[var(--color-fg-muted)]">
        <MapPinOff className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">Страница не найдена</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--color-fg-muted)]">
        Возможно, ссылка устарела или клуб архивирован.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Button>
      </Link>
    </main>
  );
}
