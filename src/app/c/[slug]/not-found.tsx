import Link from "next/link";

export default function ClubNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Клуб не найден</h1>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
        Проверь ссылку — возможно, она устарела или клуб архивирован.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
      >
        На главную
      </Link>
    </main>
  );
}
