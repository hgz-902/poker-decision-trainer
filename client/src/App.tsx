import React from "react";
import { Link, Route, Routes } from "react-router-dom";
import ScenarioListPage from "./pages/ScenarioListPage";
import PlayPage from "./pages/PlayPage";
import ResultsPage from "./pages/ResultsPage";

const shellStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  maxWidth: 1100,
  margin: "0 auto",
  padding: 16
};

export default function App() {
  return (
    <div style={shellStyle}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Poker Decision Trainer (MVP)</h2>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/">Scenarios</Link>
          <Link to="/results">Results</Link>
        </nav>
      </header>

      <hr />

      <Routes>
        <Route path="/" element={<ScenarioListPage />} />
        <Route path="/play/:id" element={<PlayPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </div>
  );
}
