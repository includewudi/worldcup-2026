import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { SyncProvider } from "@/contexts/SyncContext";
import Dashboard from "@/pages/Dashboard";
import TeamsPage from "@/pages/TeamsPage";
import FixturesPage from "@/pages/FixturesPage";
import PredictPage from "@/pages/PredictPage";
import SimulationPage from "@/pages/SimulationPage";
import FollowPage from "@/pages/FollowPage";
import StandingsPage from "@/pages/StandingsPage";
import KnockoutPage from "@/pages/KnockoutPage";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SyncProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/follow" element={<FollowPage />} />
            <Route path="/standings" element={<StandingsPage />} />
            <Route path="/knockout" element={<KnockoutPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/fixtures" element={<FixturesPage />} />
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/simulate" element={<SimulationPage />} />
          </Route>
        </Routes>
      </SyncProvider>
    </BrowserRouter>
  </React.StrictMode>
);
