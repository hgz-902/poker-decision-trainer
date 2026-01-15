import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { scenariosRouter } from "./scenarios";

const app = express();

app.use(cors());
app.use(express.json());

// API
app.use("/api/scenarios", scenariosRouter);
app.get("/health", (_req, res) => res.json({ ok: true }));

// ✅ Production: serve client/dist
// Render에서 `npm -w server run start`로 실행하면 cwd가 보통 `.../server` 입니다.
// client 빌드 산출물은 `../client/dist`
const clientDistPath = path.resolve(process.cwd(), "../client/dist");
const clientIndexHtml = path.join(clientDistPath, "index.html");

if (fs.existsSync(clientDistPath) && fs.existsSync(clientIndexHtml)) {
  app.use(express.static(clientDistPath));

  // SPA fallback (React Router)
  app.get("*", (req, res) => {
    // API는 여기서 잡히면 안 됨
    if (req.path.startsWith("/api")) return res.status(404).end();
    res.sendFile(clientIndexHtml);
  });
} else {
  // 빌드 산출물이 없을 때 디버깅용 메시지
  app.get("/", (_req, res) => {
    res
      .status(200)
      .send(
        `Client build not found. Expected: ${clientDistPath}\nBuild client first (client/dist).`
      );
  });
}

const port = Number(process.env.PORT ?? 10000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
