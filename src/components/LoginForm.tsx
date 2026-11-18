"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * Login form collecting the Mixpanel service account credentials, project ID and
 * region. Posts them to /api/login; the secret is never stored in the browser.
 * @returns The login form.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Submits the credentials and navigates to the dashboard on success.
   * @param event - Form submit event.
   */
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user: form.get("user"),
          secret: form.get("secret"),
          projectId: form.get("projectId"),
          region: form.get("region"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
        return;
      }
      router.replace("/");
    } catch {
      setError("Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login">
      <form className="login-form" onSubmit={onSubmit}>
        <h1>Sign in to Mixpanel</h1>
        <label>
          Service account user
          <input name="user" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true" required />
        </label>
        <label>
          Service account secret
          <input name="secret" type="password" autoComplete="new-password" required />
        </label>
        <label>
          Project ID
          <input name="projectId" type="text" inputMode="numeric" autoComplete="off" required />
        </label>
        <label>
          Region
          <select name="region" defaultValue="eu">
            <option value="us">US</option>
            <option value="eu">EU</option>
            <option value="in">India</option>
          </select>
        </label>
        {error && <p role="alert" className="login-error">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
