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

export function generateInvoiceNumber(sequence: number) {
  const year = new Date().getFullYear();
  return `MYB-${year}-${String(sequence).padStart(4, "0")}`;
}

export function getDueDateFromIssue(issueDate: Date, days = 30) {
  const due = new Date(issueDate);
  due.setDate(due.getDate() + days);
  return due;
}
