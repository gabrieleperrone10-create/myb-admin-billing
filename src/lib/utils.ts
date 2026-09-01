import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("it-IT").format(new Date(date));
}

export function getDueDateFromIssue(issueDate: Date, days = 30) {
  const due = new Date(issueDate);
  due.setDate(due.getDate() + days);
  return due;
}
