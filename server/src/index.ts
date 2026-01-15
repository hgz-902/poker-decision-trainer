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
// ✅ Production: serve client/dist (robust path)
// --------------------
const candidates = [
  // 1) repo root가 cwd인 경우
  path.resolve(process.cwd(), "client/dist"),
  // 2) server 폴더가 cwd인 경우
  path.resolve(process.cwd(), "../client/dist"),
  // 3) dist 기준으로 한 번 더 (혹시 더 깊은 위치에서 실행되는 경우)
  path.resolve(process.cwd(), "../../client/dist"),
];

let clientDistPath = "";
for (const p of candidates) {
  const indexHtml = path.join(p, "index.html");
  if (fs.existsSync(p) && fs.existsSync(indexHtml)) {
    clientDistPath = p;
    break;
  }
}

if (clientDistPath) {
  const clientIndexHtml = path.join(clientDistPath, "index.html");

  app.use(express.static(clientDistPath));

  // SPA fallback (React Router)
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(clientIndexHtml);
  });

  console.log("[static] serving:", clientDistPath);
} else {
  // dist가 없을 때 디버깅용 (Render에서 cwd/시도경로 확인 가능)
  app.get("/", (_req, res) => {
    res
      .status(200)
      .send(
        `Client build not found.\n` +
          `cwd=${process.cwd()}\n` +
          `tried:\n- ${candidates.join("\n- ")}\n`
      );
  });
}

// Render는 PORT=10000 같은 값을 주입함
const PORT = process.env.PORT ? Number(process.env.PORT) : 10000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
