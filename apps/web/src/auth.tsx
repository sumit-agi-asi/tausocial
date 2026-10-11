import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, configureApi } from './api';
import { MyProfile, Session } from './types';

const STORAGE_KEY = 'tausocial.session';

interface AuthState {
  session: Session | null;
  user: MyProfile | null;
  signIn: (session: Session) => void;
  signOut: () => void;
  setUser: (user: MyProfile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** The session lives in sessionStorage only: it is cached locally and removed when the tab closes. */
function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const signIn = useCallback((next: Session) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const setUser = useCallback((user: MyProfile) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, user };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    configureApi({ getToken: () => session?.token ?? null, onUnauthorized: signOut });
  }, [session, signOut]);

  // Keep the cached profile fresh (and drop dead sessions) when the app starts.
  useEffect(() => {
    if (!session) return;
    api
      .me()
      .then(setUser)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, signIn, signOut, setUser }),
    [session, signIn, signOut, setUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
