"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";

type HealthCheck = { status: "ok" | "error" | "not_configured"; message: string };
type HealthResponse = { checks?: Record<string, HealthCheck> };

const checks = [
  ["database", "Published content access"],
  ["storage", "Media storage"],
  ["configuration", "Runtime configuration"],
] as const;

function labelFor(status: HealthCheck["status"] | "checking") {
  if (status === "ok") return "Operational";
  if (status === "not_configured") return "Setup needed";
  if (status === "error") return "Unavailable";
  return "Checking";
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch(() => setHealth({ checks: { configuration: { status: "error", message: "The health check could not be reached." } } }));
  }, []);

  return <AdminShell><div className="eyebrow">Operations</div><h1>System status</h1><p className="muted">A quick view of the services that power your content platform.</p><div className="status-list">{checks.map(([key, name]) => { const check = health?.checks?.[key]; const status = check?.status ?? "checking"; return <div key={key}><span className={`health-dot ${status === "ok" ? "good" : status === "error" ? "error" : "pending"}`}></span><div><strong>{name}</strong><p className="muted compact">{check?.message ?? "Checking connection…"}</p></div><span className={`status ${status === "ok" ? "status-published" : status === "error" ? "status-error" : "status-draft"}`}>{labelFor(status)}</span></div>; })}</div></AdminShell>;
}
