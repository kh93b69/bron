import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTenge(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ₸`;
}

export function hoursBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}
