import { Scenario, ScenarioMeta } from "./types";

const BASE = "http://localhost:4000";

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
