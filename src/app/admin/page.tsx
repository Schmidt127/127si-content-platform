"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSession } from "@/lib/supabase-browser";
import { AdminShell } from "./AdminShell";
export default function AdminPage() {
  const [count, setCount] = useState(0);
  useEffect(() => { void (async () => { const session = await getBrowserSession(); if (!session) { window.location.href = "/admin/login"; return; } const response = await fetch("/api/admin/content", { headers: { Authorization: `Bearer ${session.access_token}` } }); const result = await response.json(); setCount(result.data?.length ?? 0); })(); }, []);
  return <AdminShell><div className="page-heading"><div><div className="eyebrow">127SI admin workspace</div><h1>Content, organized.</h1><p className="lead">Create, review, publish, and deliver the material that powers your connected platforms.</p></div><Link className="button button-primary" href="/admin/new">+ New content</Link></div><div className="stat-grid"><Link className="card stat-card" href="/admin/records"><div className="eyebrow">Content records</div><div className="stat-number">{count}</div><p className="muted">Tutorials, readings, and Shout Outs</p></Link><Link className="card stat-card" href="/admin/assets"><div className="eyebrow">Asset library</div><div className="stat-number">→</div><p className="muted">Images, videos, and documents</p></Link><Link className="card stat-card" href="/admin/integrations"><div className="eyebrow">Consumer delivery</div><div className="stat-number">API</div><p className="muted">Connect Challenge-Platform and more</p></Link></div><section className="welcome-panel"><div><div className="eyebrow">Fast workflow</div><h2>Make it once. Use it everywhere.</h2><p className="muted">Add your content and media together, publish when ready, and let consumer platforms read the public API.</p></div><Link className="text-link" href="/admin/records">View all records →</Link></section></AdminShell>;
}
