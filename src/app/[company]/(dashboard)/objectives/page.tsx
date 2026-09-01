export const dynamic = "force-dynamic";
import { getObjectives } from "@/app/actions/objectives";
import ObjectivesClient from "./ObjectivesClient";

export default async function ObjectivesPage() {
  const year = new Date().getFullYear();
  const objectives = await getObjectives(year);
  return <ObjectivesClient objectives={objectives} year={year} />;
}
