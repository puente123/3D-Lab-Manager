/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchPromiseRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Helper function to fetch user profile with role
  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      return null;
    }

    // If a fetch is already in progress for the same user, return that promise
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

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
      }
    })();

    // Store promise so concurrent calls can reuse it
    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  // Restore session on refresh
  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const userWithProfile = await fetchUserProfile(session.user);
          if (userWithProfile) {
            setUser(userWithProfile);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        setUser(null);
      } finally {
        setLoading(false);
        isInitializedRef.current = true;
      }
    };

    init();

    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION to prevent duplicate fetch on mount
        if (event === "INITIAL_SESSION" && !isInitializedRef.current) {
          return;
        }

        // Only fetch profile for relevant events
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          if (session?.user) {
            const userWithProfile = await fetchUserProfile(session.user);
            if (userWithProfile) {
              setUser(userWithProfile);
            }
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
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

  //
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
