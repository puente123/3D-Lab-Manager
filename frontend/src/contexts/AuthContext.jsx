/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchPromiseRef = useRef(null);
  const currentUserIdRef = useRef(null);

  // Helper function to fetch user profile with role
  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      fetchPromiseRef.current = null;
      currentUserIdRef.current = null;
      return null;
    }

    // If a fetch is already in progress for the SAME user, return that promise
    if (fetchPromiseRef.current && currentUserIdRef.current === authUser.id) {
      return fetchPromiseRef.current;
    }

    // Clear any stale promise for a different user
    if (currentUserIdRef.current !== authUser.id) {
      fetchPromiseRef.current = null;
    }

    // Store current user ID
    currentUserIdRef.current = authUser.id;

    // Create new fetch promise
    const fetchPromise = (async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", authUser.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          // Return user with default role if query fails
          return {
            ...authUser,
            role: "student",
            full_name: authUser.email?.split("@")[0] || null,
          };
        }

        return {
          ...authUser,
          role: profile?.role || "student",
          full_name: profile?.full_name,
        };
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        return {
          ...authUser,
          role: "student",
          full_name: authUser.email?.split("@")[0] || null,
        };
      } finally {
        // Clear the promise cache after completion
        fetchPromiseRef.current = null;
        currentUserIdRef.current = null;
      }
    })();

    // Store promise so concurrent calls can reuse it
    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  // Restore session on refresh
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        // If session retrieval failed or returned an error, clear storage
        if (sessionError) {
          console.error("Session error:", sessionError);
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          const userWithProfile = await fetchUserProfile(session.user);
          if (mounted) {
            // Always set user state, even if fetchUserProfile returns null
            setUser(userWithProfile || null);
          }
        } else {
          if (mounted) {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        // Clear potentially corrupted session on error
        await supabase.auth.signOut();
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    // Listen for login/logout - set up AFTER init starts
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION event entirely - init() handles initial load
        if (event === "INITIAL_SESSION") {
          return;
        }

        if (!mounted) return;

        // Only fetch profile for relevant events
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          if (session?.user) {
            const userWithProfile = await fetchUserProfile(session.user);
            if (mounted) {
              setUser(userWithProfile || null);
            }
          }
        } else if (event === "SIGNED_OUT") {
          if (mounted) {
            setUser(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
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
      // Clear cached promises and user refs
      fetchPromiseRef.current = null;
      currentUserIdRef.current = null;

      // Sign out from Supabase (clears localStorage automatically)
      await supabase.auth.signOut();

      // Set user to null
      setUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
      // Force clear even if signOut fails
      fetchPromiseRef.current = null;
      currentUserIdRef.current = null;
      setUser(null);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
