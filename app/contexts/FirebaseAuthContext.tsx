"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  applyTheme,
  readLocalSettingsForCloud,
  readTheme,
  writeFavoritesOrder,
  writeLibrarySync,
  writeRecent,
} from "@/lib/browserPrefs";
import { getFirebaseAuth, isFirebaseWebConfigured } from "@/lib/firebase/client";
import { loadUserSettingsDoc, saveUserSettingsDoc, type UserSettingsPayload } from "@/lib/firebase/userSettingsFirestore";
import type { LibrarySyncState } from "@/lib/browserPrefsConstants";

function mapAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Try signing in.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Use a stronger password (at least 6 characters).";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    default:
      return "Something went wrong. Try again.";
  }
}

function applyRemoteToLocal(remote: UserSettingsPayload) {
  if (remote.favorites && Array.isArray(remote.favorites)) {
    writeFavoritesOrder(remote.favorites);
  }
  if (remote.recent && Array.isArray(remote.recent)) {
    writeRecent(remote.recent);
  }
  if (remote.theme === "light" || remote.theme === "dark") {
    applyTheme(remote.theme);
  } else {
    applyTheme(readTheme());
  }
  const lib: LibrarySyncState = {};
  if (typeof remote.lastChannelUrl === "string") lib.lastChannelUrl = remote.lastChannelUrl;
  if (remote.libraryView === "all" || remote.libraryView === "favorites") lib.libraryView = remote.libraryView;
  if (typeof remote.libraryCategory === "string") lib.libraryCategory = remote.libraryCategory;
  if (typeof remote.libraryQuery === "string") lib.libraryQuery = remote.libraryQuery;
  if (Object.keys(lib).length) writeLibrarySync(lib);
}

type FirebaseAuthContextValue = {
  user: User | null;
  authLoading: boolean;
  hasFirebaseConfig: boolean;
  prefsHydrateVersion: number;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const v = useContext(FirebaseAuthContext);
  if (!v) {
    throw new Error("useFirebaseAuth must be used within FirebaseAuthProvider");
  }
  return v;
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [prefsHydrateVersion, setPrefsHydrateVersion] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasFirebaseConfig = isFirebaseWebConfigured();

  const bumpHydrate = useCallback(() => {
    setPrefsHydrateVersion((n) => n + 1);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setAuthLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [hasFirebaseConfig]);

  const lastHydratedUid = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      lastHydratedUid.current = null;
      return;
    }
    if (lastHydratedUid.current === user.uid) return;

    let cancelled = false;
    (async () => {
      const remote = await loadUserSettingsDoc(user.uid);
      if (cancelled) return;

      if (!remote) {
        const local = readLocalSettingsForCloud();
        await saveUserSettingsDoc(user.uid, local);
        lastHydratedUid.current = user.uid;
        bumpHydrate();
        return;
      }

      applyRemoteToLocal(remote);
      lastHydratedUid.current = user.uid;
      bumpHydrate();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, bumpHydrate]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      setAuthError(mapAuthError(code));
      throw e;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user && !cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user);
        } catch {
          /* non-fatal */
        }
      }
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      setAuthError(mapAuthError(code));
      throw e;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      setAuthError(mapAuthError(code));
      throw e;
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      setAuthError(mapAuthError(code));
      throw e;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) return;
    lastHydratedUid.current = null;
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      authLoading,
      hasFirebaseConfig,
      prefsHydrateVersion,
      authError,
      clearAuthError,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      signOutUser,
    }),
    [
      user,
      authLoading,
      hasFirebaseConfig,
      prefsHydrateVersion,
      authError,
      clearAuthError,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      signOutUser,
    ]
  );

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
}
