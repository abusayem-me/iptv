"use client";

import { useCallback, useId, useState } from "react";
import { useFirebaseAuth } from "@/app/contexts/FirebaseAuthContext";

type Mode = "signin" | "signup" | "reset";

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
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="auth-modal-head">
          <h2 id={titleId} className="auth-modal-title">
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "reset" && "Reset password"}
          </h2>
          <button type="button" className="auth-modal-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        <div className="auth-modal-body">
          {mode !== "reset" ? (
            <button
              type="button"
              className="btn-google"
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
              <span className="btn-google-icon" aria-hidden>
                G
              </span>
              Continue with Google
            </button>
          ) : null}

          {mode !== "reset" ? <div className="auth-or">or email</div> : null}

          <form onSubmit={onSubmit} className="auth-form">
            <label className="auth-label">
              Email
              <input
                className="auth-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== "reset" ? (
              <label className="auth-label">
                Password
                <input
                  className="auth-input"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            ) : null}
            {mode === "signup" ? (
              <label className="auth-label">
                Confirm password
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </label>
            ) : null}

            {authError ? <p className="auth-msg auth-msg-error">{authError}</p> : null}
            {info ? <p className="auth-msg auth-msg-info">{info}</p> : null}

            <button type="submit" className="btn-auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset email"}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "signin" ? (
              <>
                <button type="button" className="btn-link" onClick={() => { resetForm(); setMode("signup"); }}>
                  Create an account
                </button>
                <span className="auth-dot">·</span>
                <button type="button" className="btn-link" onClick={() => { resetForm(); setMode("reset"); }}>
                  Forgot password?
                </button>
              </>
            ) : null}
            {mode === "signup" ? (
              <button type="button" className="btn-link" onClick={() => { resetForm(); setMode("signin"); }}>
                Already have an account? Sign in
              </button>
            ) : null}
            {mode === "reset" ? (
              <button type="button" className="btn-link" onClick={() => { resetForm(); setMode("signin"); }}>
                Back to sign in
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
