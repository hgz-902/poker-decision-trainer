import { AttemptResult } from "./types";

const KEY = "pdt_results_v1";

export function loadAttempts(): AttemptResult[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AttemptResult[];
  } catch {
    return [];
  }
}

export function saveAttempt(a: AttemptResult) {
  const all = loadAttempts();
  all.push(a);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearAttempts() {
  localStorage.removeItem(KEY);
}

export function scenarioStats(scenarioId: string) {
  const all = loadAttempts().filter((x) => x.scenarioId === scenarioId);
  const attempts = all.length;
  const correct = all.filter((x) => x.isCorrect).length;
  const acc = attempts === 0 ? 0 : correct / attempts;
  return { attempts, correct, acc };
}
