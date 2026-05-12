"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleAutomation(type: string, active: boolean) {
  await prisma.automation.upsert({
    where:  { type },
    update: { active },
    create: { type, active },
  });
  revalidatePath("/automations");
}

export async function updateAutomationConfig(type: string, config: Record<string, string>) {
  await prisma.automation.upsert({
    where:  { type },
    update: { config: config as never },
    create: { type, active: false, config: config as never },
  });
  revalidatePath("/automations");
}
