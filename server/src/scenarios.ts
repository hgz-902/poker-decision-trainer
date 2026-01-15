import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenariosDir = path.resolve(__dirname, "..", "scenarios");

type ScenarioMeta = {
  id: string;
  title: string;
  tags: string[];
  difficulty: number;
};

export async function getScenarioList(): Promise<ScenarioMeta[]> {
  const files = await fs.readdir(scenariosDir);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));

  const metas: ScenarioMeta[] = [];
  for (const f of jsonFiles) {
    const full = path.join(scenariosDir, f);
    const raw = await fs.readFile(full, "utf-8");
    const obj = JSON.parse(raw);
    metas.push({
      id: obj.id,
      title: obj.title,
      tags: obj.tags ?? [],
      difficulty: obj.difficulty ?? 1
    });
  }

  metas.sort((a, b) => a.id.localeCompare(b.id));
  return metas;
}

export async function getScenarioById(id: string): Promise<any | null> {
  const file = path.join(scenariosDir, `${id}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
