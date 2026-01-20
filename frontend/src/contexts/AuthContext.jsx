import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper function to fetch user profile with role
  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      console.log("fetchUserProfile: no authUser provided");
      return null;
    }

    console.log("fetchUserProfile: fetching profile for user", authUser.id);

    try {
      // Add timeout to prevent infinite hanging
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.warn("Profile fetch timed out after 8 seconds, using default role");
          resolve({ data: null, error: { message: "Timeout" } });
        }, 8000);
      });

      const queryPromise = supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authUser.id)
        .single();

      const { data: profile, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error("Error fetching user profile:", error);
        // Return user without profile data if query fails
        return {
          ...authUser,
          role: "student",
          full_name: null,
        };
      }

      console.log("fetchUserProfile: profile fetched successfully", profile);

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
        full_name: null,
      };
    }
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
          setUser(userWithProfile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);

        if (session?.user) {
          const userWithProfile = await fetchUserProfile(session.user);
          setUser(userWithProfile);
        } else {
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
