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
