export const dynamic = "force-dynamic";
import { getObjectives } from "@/app/actions/objectives";
import ObjectivesClient from "./ObjectivesClient";

export default async function ObjectivesPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const year = new Date().getFullYear();
  const objectives = await getObjectives(slug, year);
  return <ObjectivesClient objectives={objectives} year={year} />;
}
