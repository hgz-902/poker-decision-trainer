import { Scenario, ScenarioMeta } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

export async function fetchScenarioList(): Promise<ScenarioMeta[]> {
  const res = await fetch(`${BASE}/api/scenarios`);
  if (!res.ok) throw new Error("Failed to load scenarios");
  return res.json();
}

export async function fetchScenario(id: string): Promise<Scenario> {
  const res = await fetch(`${BASE}/api/scenarios/${id}`);
  if (!res.ok) throw new Error("Failed to load scenario");
  return res.json();
}
