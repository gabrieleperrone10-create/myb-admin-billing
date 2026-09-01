"use server";
import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";

export const toggleAutomation = companyAction(async (ctx, type: string, active: boolean) => {
  await ctx.db.automation.upsert({
    where:  { companyId_type: { companyId: ctx.companyId, type } },
    update: { active },
    create: { companyId: ctx.companyId, type, active },
  });
  revalidatePath(`/${ctx.slug}/automations`);
});

export const updateAutomationConfig = companyAction(async (ctx, type: string, config: Record<string, string>) => {
  await ctx.db.automation.upsert({
    where:  { companyId_type: { companyId: ctx.companyId, type } },
    update: { config: config as never },
    create: { companyId: ctx.companyId, type, active: false, config: config as never },
  });
  revalidatePath(`/${ctx.slug}/automations`);
});
