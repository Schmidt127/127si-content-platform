"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("Signing in...");
    const values = new FormData(event.currentTarget);
    const { error } = await (getSupabaseBrowser().auth as any).signInWithPassword({ email: String(values.get("email") ?? ""), password: String(values.get("password") ?? "") });
    if (error) { setMessage(error.message); return; }
    window.location.href = "/admin/new";
  }
  return <main className="shell"><nav className="nav"><div className="brand">127SI ADMIN</div><Link href="/">Home</Link></nav><section className="hero"><div className="eyebrow">Admin sign in</div><h1>Sign in to add content.</h1><form onSubmit={submit} style={{display:"grid", gap:16, maxWidth:480}}><label>Email<input required type="email" name="email" style={{display:"block", width:"100%", padding:12, marginTop:6}} /></label><label>Password<input required type="password" name="password" style={{display:"block", width:"100%", padding:12, marginTop:6}} /></label><button className="button" type="submit" style={{border:0, cursor:"pointer", width:"fit-content"}}>Sign in</button>{message && <p className="muted">{message}</p>}</form></section></main>;
}
