/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  const withTimeout = useCallback((promise, ms, label) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  }, []);

  const clearSupabaseAuthStorage = useCallback(() => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const ref = supabaseUrl
        .replace(/^https?:\/\//, "")
        .split(".")[0]
        .trim();

      const shouldRemoveKey = (key) => {
        if (!key) return false;
        if (ref && key.includes(`sb-${ref}`)) return true;
        if (key.startsWith("supabase.auth.")) return true;
        return false;
      };

      Object.keys(localStorage).forEach((key) => {
        if (shouldRemoveKey(key)) {
          localStorage.removeItem(key);
        }
      });

      Object.keys(sessionStorage).forEach((key) => {
        if (shouldRemoveKey(key)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Failed to clear Supabase auth storage:", error);
    }
  }, []);

  // Helper function to fetch user profile with role
  const fetchUserProfile = useCallback(async (authUser, retryCount = 0) => {
    if (!authUser) {
      return null;
    }

    const maxRetries = 2;
    console.log(`[Auth] Fetching profile for user: ${authUser.id} (attempt ${retryCount + 1}/${maxRetries + 1})`);
    const startTime = Date.now();

    try {
      // Use shorter timeout per attempt (5s) and rely on retries
      const { data: profile, error } = await withTimeout(
        supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", authUser.id)
          .single(),
        5000,
        "Get profile"
      );

      const fetchTime = Date.now() - startTime;
      console.log(`[Auth] Profile query completed in ${fetchTime}ms`);

      if (error) {
        console.error("[Auth] ❌ Profile query error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        // Retry on specific errors
        const shouldRetry =
          retryCount < maxRetries &&
          (error.code === 'PGRST301' ||
           error.code === 'PGRST116' ||
           error.message?.toLowerCase().includes('timeout') ||
           error.message?.toLowerCase().includes('network') ||
           error.message?.toLowerCase().includes('fetch'));

        if (shouldRetry) {
          const delay = 500 * (retryCount + 1); // 500ms, 1s, 1.5s
          console.log(`[Auth] ⏳ Retrying in ${delay}ms (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchUserProfile(authUser, retryCount + 1);
        }

        // After all retries failed, use default role
        const userData = {
          ...authUser,
          role: "student",
          full_name: authUser.email?.split("@")[0] || null,
        };
        console.warn("[Auth] ⚠️ Using default role 'student' - profile fetch failed after retries");
        return userData;
      }

      if (!profile) {
        console.warn("[Auth] ⚠️ Profile not found in database for user:", authUser.id);
        const userData = {
          ...authUser,
          role: "student",
          full_name: authUser.email?.split("@")[0] || null,
        };
        return userData;
      }

      const userData = {
        ...authUser,
        role: profile.role || "student",
        full_name: profile.full_name,
      };
      console.log("[Auth] ✅ Profile loaded successfully:", {
        role: userData.role,
        full_name: userData.full_name,
      });
      return userData;
    } catch (err) {
      const fetchTime = Date.now() - startTime;
      console.error(`[Auth] ❌ Profile fetch exception after ${fetchTime}ms:`, {
        message: err.message,
        name: err.name,
      });

      // Retry on timeout exceptions
      if (retryCount < maxRetries && err.message?.toLowerCase().includes('timed out')) {
        const delay = 500 * (retryCount + 1);
        console.log(`[Auth] ⏳ Retrying after timeout in ${delay}ms (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserProfile(authUser, retryCount + 1);
      }

      const userData = {
        ...authUser,
        role: "student",
        full_name: authUser.email?.split("@")[0] || null,
      };
      console.warn("[Auth] ⚠️ Using default role 'student' - exception after retries");
      return userData;
    }
  }, [withTimeout]);

  // Restore session on refresh
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Prevent duplicate initialization (React StrictMode runs effects twice)
      if (initializingRef.current || initializedRef.current) {
        console.log("[Auth] ⏭️ Skipping duplicate initialization");
        return;
      }

      initializingRef.current = true;

      try {
        console.log("[Auth] 🔄 Initializing authentication...");

        // Log localStorage size for debugging
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
        const ref = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0].trim();
        const authKey = `sb-${ref}-auth-token`;
        const storedData = localStorage.getItem(authKey);
        if (storedData) {
          console.log("[Auth] 📦 Stored session data size:", (storedData.length / 1024).toFixed(2), "KB");
        } else {
          console.log("[Auth] 📦 No stored session data found");
        }

        const startTime = Date.now();
        console.log("[Auth] 📡 Calling supabase.auth.getSession()...");

        // Don't use timeout for session restoration - let Supabase handle it
        // Timeouts can cause false negatives on slow connections
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        console.log("[Auth] 📡 getSession() returned");

        const sessionTime = Date.now() - startTime;
        console.log(`[Auth] Session fetch took ${sessionTime}ms`);

        // If session retrieval failed with an actual error (not timeout)
        if (sessionError) {
          console.error("[Auth] ❌ Session retrieval failed:", {
            message: sessionError.message,
            code: sessionError.code,
            status: sessionError.status,
          });
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          console.log("[Auth] ✅ Session found for user:", session.user.id, session.user.email);
          const profileStartTime = Date.now();
          const userWithProfile = await fetchUserProfile(session.user);
          const profileTime = Date.now() - profileStartTime;
          console.log(`[Auth] Total profile fetch time: ${profileTime}ms`);

          if (mounted) {
            console.log("[Auth] ✅ User state updated with profile. Final user object:", {
              id: userWithProfile?.id,
              email: userWithProfile?.email,
              role: userWithProfile?.role,
              full_name: userWithProfile?.full_name,
            });
            setUser(userWithProfile || null);
          }
        } else {
          console.log("[Auth] ℹ️ No session found - user is not logged in");
          if (mounted) {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("[Auth] ❌ Unexpected error during auth initialization:", {
          error: err,
          message: err.message,
          stack: err.stack,
        });
        // Don't clear user on unexpected errors during init
        // This prevents logout on network issues
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          console.log("[Auth] Authentication initialization completed. Setting loading to false.");
          setLoading(false);
          initializingRef.current = false;
          initializedRef.current = true;
        }
      }
    };

    init();

    // Listen for login/logout - set up AFTER init starts
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION event entirely - init() handles initial load
        if (event === "INITIAL_SESSION") {
          console.log("[Auth] ⏭️ Skipping INITIAL_SESSION event (handled by init)");
          return;
        }

        if (!mounted) return;

        // Wait for initial authentication to complete before processing events
        // This prevents race conditions from React StrictMode double-rendering
        if (!initializedRef.current) {
          console.log("[Auth] ⏳ Waiting for initialization to complete before processing event:", event);
          return;
        }

        // Only fetch profile for relevant events
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          console.log("[Auth] 📨 Auth event:", event);
          if (session?.user) {
            const userWithProfile = await fetchUserProfile(session.user);
            if (mounted) {
              setUser(userWithProfile || null);
            }
          }
        } else if (event === "SIGNED_OUT") {
          console.log("[Auth] 👋 User signed out");
          // Clear user state - don't call signOut again to avoid infinite loop
          if (mounted) {
            setUser(null);
          }
          // Clear any cached auth data in storage
          clearSupabaseAuthStorage();
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      // Reset flags on unmount (for hot reload in development)
      initializingRef.current = false;
      initializedRef.current = false;
    };
  }, [fetchUserProfile, clearSupabaseAuthStorage]);

  const login = async (email, password) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        15000,
        "Login"
      );

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      console.error("Login failed:", error);
      return {
        success: false,
        error:
          "Login timed out. Please check your connection and try again.",
      };
    }
  };

  const signup = async ({ firstName, lastName, email, password }) => {
    // Create Auth Account
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };

    const authUser = data?.user;
    if (!authUser) return { success: false, error: "Signup failed." };

    // Insert user into profiles table
    const fullName = `${firstName} ${lastName}`.trim();
    await supabase.from("profiles").upsert({
      id: authUser.id,
      full_name: fullName,
      email: email,
      role: "student",
    });

    return { success: true };
  };

  const logout = async () => {
    try {
      // Sign out from Supabase (clears localStorage automatically)
      await supabase.auth.signOut();

      // Set user to null
      setUser(null);
      console.log("[Auth] Logout successful");
    } catch (error) {
      console.error("[Auth] Error during logout:", error);
      // Force clear even if signOut fails
      setUser(null);
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        10000,
        "Password reset request"
      );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Password reset request failed:", error);
      return {
        success: false,
        error: "Failed to send password reset email. Please try again.",
      };
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ password: newPassword }),
        10000,
        "Update password"
      );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Password update failed:", error);
      return {
        success: false,
        error: "Failed to update password. Please try again.",
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
