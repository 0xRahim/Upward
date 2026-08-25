"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authApi, configureAuthHooks, ApiError, usersApi } from "@/lib/api";
import type { User } from "@/lib/types";

const STORAGE_KEY = "upward.auth";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function loadTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens | null) {
  if (typeof window === "undefined") return;
  if (tokens) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else window.localStorage.removeItem(STORAGE_KEY);
}

let cachedTokens: StoredTokens | null = null;

if (typeof window !== "undefined") {
  cachedTokens = loadTokens();
}

configureAuthHooks(
  () => cachedTokens,
  (tokens) => {
    cachedTokens = tokens;
    saveTokens(tokens);
  }
);

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  const fetchUser = React.useCallback(async () => {
    try {
      const me = await usersApi.me();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      saveTokens(null);
      cachedTokens = null;
      return null;
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cachedTokens) {
        setLoading(false);
        return;
      }
      const me = await fetchUser();
      if (!cancelled) setLoading(false);
      if (!me && !cancelled) {
        // access + refresh both dead
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUser]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password });
      const tokens = { accessToken: res.accessToken, refreshToken: res.refreshToken };
      cachedTokens = tokens;
      saveTokens(tokens);
      await fetchUser();
    },
    [fetchUser]
  );

  const register = React.useCallback(
    async (name: string, email: string, password: string) => {
      await authApi.register({ name, email, password });
      await login(email, password);
    },
    [login]
  );

  const logout = React.useCallback(async () => {
    try {
      if (cachedTokens) await authApi.logout(cachedTokens.refreshToken);
    } catch {
      // ignore — clear locally regardless
    }
    cachedTokens = null;
    saveTokens(null);
    setUser(null);
    router.push("/");
  }, [router]);

  const refreshUser = React.useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
