"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  const disabled = status === "sending" || status === "sent";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-8"
        style={{ border: "1px solid var(--border)" }}
      >
        <h1 className="font-display italic text-3xl text-ink">
          JF &amp; The World
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          for us — a magic link is on its way.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={disabled}
            className="h-12 w-full rounded-lg bg-bg px-4 text-base text-ink outline-none placeholder:text-ink-soft disabled:opacity-60"
            style={{ border: "1px solid var(--border)" }}
          />
          <button
            type="submit"
            disabled={disabled || !email}
            className="h-12 w-full rounded-lg bg-accent font-display italic text-lg text-bg disabled:opacity-50"
          >
            {status === "sending"
              ? "sending…"
              : status === "sent"
                ? "Check your email"
                : "Send the link"}
          </button>
        </form>

        {status === "sent" && (
          <p className="mt-4 font-handwritten text-[18px] text-ink">
            Sent. Click the link in your inbox.
          </p>
        )}
        {status === "error" && errorMessage && (
          <p className="mt-4 text-sm text-accent">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
