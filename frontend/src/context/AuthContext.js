import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  apiLogin,
  apiRegister,
  apiGetCurrentUser,
  getStoredAuthData,
  clearAuthData
} from '../api/client';

const AuthContext = createContext({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from AsyncStorage on startup
  useEffect(() => {
    async function loadSession() {
      try {
        const stored = await getStoredAuthData();
        if (stored.token && stored.user) {
          setToken(stored.token);
          setUser(stored.user);

          // Verify token in background with backend
          try {
            const freshUser = await apiGetCurrentUser(stored.token);
            if (freshUser) {
              setUser(freshUser);
            }
          } catch (verifyErr) {
            console.log('Session verification note:', verifyErr.message);
            // If token expired (401/403), log out
            if (verifyErr.status === 401 || verifyErr.status === 403) {
              await clearAuthData();
              setToken(null);
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await apiLogin({ email, password });
    setToken(result.token);
    setUser(result.user);
    return result;
  }, []);

  const register = useCallback(async ({ name, email, password, program, profilePictureBase64 }) => {
    const result = await apiRegister({ name, email, password, program, profilePictureBase64 });
    setToken(result.token);
    setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await clearAuthData();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    try {
      const freshUser = await apiGetCurrentUser(token);
      setUser(freshUser);
      return freshUser;
    } catch (err) {
      console.error('Error refreshing user profile:', err);
      return null;
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
