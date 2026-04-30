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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We&rsquo;ll email you a magic link.
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
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base outline-none focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
          <button
            type="submit"
            disabled={disabled || !email}
            className="h-12 w-full rounded-lg bg-zinc-900 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {status === "sending"
              ? "Sending…"
              : status === "sent"
                ? "Check your email"
                : "Send magic link"}
          </button>
        </form>

        {status === "sent" && (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Sent. Click the link in your inbox to finish signing in.
          </p>
        )}
        {status === "error" && errorMessage && (
          <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
