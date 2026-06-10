"use client";

import { useCallback, useId, useState } from "react";
import { useFirebaseAuth } from "@/app/contexts/FirebaseAuthContext";

type Mode = "signin" | "signup" | "reset";

function GoogleMark() {
  return (
    <svg className="btn-google-svg" width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.86 11.86 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function AuthAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    authError,
    clearAuthError,
  } = useFirebaseAuth();
  const titleId = useId();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setPassword("");
    setPassword2("");
    setInfo(null);
    clearAuthError();
  }, [clearAuthError]);

  const close = useCallback(() => {
    resetForm();
    setMode("signin");
    onClose();
  }, [onClose, resetForm]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfo(null);
    clearAuthError();
    if (mode === "reset") {
      setBusy(true);
      try {
        await sendPasswordReset(email);
        setInfo("Check your inbox for a reset link.");
      } catch {
        /* authError set */
      } finally {
        setBusy(false);
      }
      return;
    }
    if (mode === "signup") {
      if (password.length < 6) {
        setInfo("Password must be at least 6 characters.");
        return;
      }
      if (password !== password2) {
        setInfo("Passwords do not match.");
        return;
      }
      setBusy(true);
      try {
        await signUpWithEmail(email, password);
        close();
      } catch {
        /* authError */
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      close();
    } catch {
      /* authError */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="auth-modal auth-modal-pro"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="auth-modal-shell">
          <div className="auth-modal-aside" aria-hidden>
            <div className="auth-aside-inner">
              <p className="auth-aside-kicker">SAYEM TV</p>
              <p className="auth-aside-lead">Your library, synced everywhere.</p>
              <ul className="auth-aside-list">
                <li>Cross-device favorites &amp; continue watching</li>
                <li>Live device presence &amp; playback status</li>
                <li>Secure Google &amp; email sign-in</li>
              </ul>
            </div>
          </div>

          <div className="auth-modal-main">
            <div className="auth-modal-head">
              <h2 id={titleId} className="auth-modal-title">
                {mode === "signin" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "reset" && "Reset password"}
              </h2>
              <button type="button" className="auth-modal-close" onClick={close} aria-label="Close">
                ×
              </button>
            </div>

            {mode !== "reset" ? (
              <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signin"}
                  className={`auth-tab ${mode === "signin" ? "active" : ""}`}
                  onClick={() => {
                    resetForm();
                    setMode("signin");
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={`auth-tab ${mode === "signup" ? "active" : ""}`}
                  onClick={() => {
                    resetForm();
                    setMode("signup");
                  }}
                >
                  Register
                </button>
              </div>
            ) : null}

            <div className="auth-modal-body">
              {mode !== "reset" ? (
                <button
                  type="button"
                  className="btn-google btn-google-pro"
                  disabled={busy}
                  onClick={async () => {
                    clearAuthError();
                    setBusy(true);
                    try {
                      await signInWithGoogle();
                      close();
                    } catch {
                      /* authError */
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>
              ) : null}

              {mode !== "reset" ? (
                <div className="auth-or" aria-hidden>
                  <span className="auth-or-line" />
                  <span className="auth-or-text">or email</span>
                  <span className="auth-or-line" />
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="auth-form auth-form-pro">
                <label className="auth-field">
                  <span className="auth-field-label">Email</span>
                  <input
                    className="auth-input auth-input-pro"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                {mode !== "reset" ? (
                  <label className="auth-field">
                    <span className="auth-field-label">Password</span>
                    <input
                      className="auth-input auth-input-pro"
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                ) : null}
                {mode === "signup" ? (
                  <label className="auth-field">
                    <span className="auth-field-label">Confirm password</span>
                    <input
                      className="auth-input auth-input-pro"
                      type="password"
                      autoComplete="new-password"
                      required
                      placeholder="Repeat password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                    />
                  </label>
                ) : null}

                {authError ? <p className="auth-msg auth-msg-error">{authError}</p> : null}
                {info ? <p className="auth-msg auth-msg-info">{info}</p> : null}

                <button type="submit" className="btn-auth-submit btn-auth-submit-pro" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : mode === "signin"
                      ? "Sign in"
                      : mode === "signup"
                        ? "Create account"
                        : "Send reset email"}
                </button>
              </form>

              <div className="auth-switch auth-switch-pro">
                {mode === "signin" ? (
                  <button type="button" className="btn-link-pro" onClick={() => { resetForm(); setMode("reset"); }}>
                    Forgot password?
                  </button>
                ) : null}
                {mode === "reset" ? (
                  <button type="button" className="btn-link-pro" onClick={() => { resetForm(); setMode("signin"); }}>
                    Back to sign in
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
