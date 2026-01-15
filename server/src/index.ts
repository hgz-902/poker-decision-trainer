import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { getScenarioList, getScenarioById } from "./scenarios.js";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// Health
// --------------------
app.get("/health", (_req, res) => res.json({ ok: true }));

// --------------------
// API
// --------------------
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

// --------------------
// ✅ Production: serve client/dist
// --------------------
const clientDistPath = path.resolve(process.cwd(), "../client/dist");
const clientIndexHtml = path.join(clientDistPath, "index.html");

if (fs.existsSync(clientDistPath) && fs.existsSync(clientIndexHtml)) {
  app.use(express.static(clientDistPath));

  // SPA fallback (React Router)
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(clientIndexHtml);
  });
} else {
  // dist가 없을 때 디버깅용
  app.get("/", (_req, res) => {
    res
      .status(200)
      .send(
        `Client build not found. Expected: ${clientDistPath}\nBuild client first (client/dist).`
      );
  });
}

// Render는 PORT=10000 같은 값을 주입함
const PORT = process.env.PORT ? Number(process.env.PORT) : 10000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
