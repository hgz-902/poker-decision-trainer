import express from "express";
import cors from "cors";
import { getScenarioList, getScenarioById } from "./scenarios.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/scenarios", async (_req, res) => {
  const list = await getScenarioList();
  res.json(list);
});

app.get("/api/scenarios/:id", async (req, res) => {
  const { id } = req.params;
  const scenario = await getScenarioById(id);
  if (!scenario) return res.status(404).json({ error: "Scenario not found" });
  res.json(scenario);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
