import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { http } from "../api/http.jsx";
import { API_BASE_URL } from "../config/apiBaseUrl.js";
import { clearTokens, getAccessToken, setTokens } from "../lib/storage.jsx";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(user);

  const loadMe = useCallback(async () => {
    try {
      const response = await http.get("/api/auth/me/");
      setUser(response.data);
    } catch {
      clearTokens();
      setUser(null);
    }
  }, []);

  const loginByPath = useCallback(async (path, credentials) => {
    const loginRes = await axios.post(`${API_BASE_URL}${path}`, credentials);
    setTokens({
      access: loginRes.data.access,
      refresh: loginRes.data.refresh,
    });
    setUser(loginRes.data.user);
    return loginRes.data.user;
  }, []);

  const loginCustomer = useCallback((credentials) => loginByPath("/api/auth/login/", credentials), [loginByPath]);
  const loginAdmin = useCallback((credentials) => loginByPath("/api/auth/admin/login/", credentials), [loginByPath]);
  const loginSupplier = useCallback((credentials) => loginByPath("/api/auth/supplier/login/", credentials), [loginByPath]);
  const loginDriver = useCallback((credentials) => loginByPath("/api/auth/driver/login/", credentials), [loginByPath]);

  const registerCustomer = useCallback(async (payload) => {
    await axios.post(`${API_BASE_URL}/api/auth/register/`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }, []);

  const registerAdmin = useCallback(async (payload) => {
    await axios.post(`${API_BASE_URL}/api/auth/admin/register/`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const response = await http.patch("/api/auth/me/", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUser(response.data);
    return response.data;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      await loadMe();
      setLoading(false);
    };
    init();
  }, [loadMe]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated,
      loginCustomer,
      loginAdmin,
      loginSupplier,
      loginDriver,
      registerCustomer,
      registerAdmin,
      logout,
      reloadUser: loadMe,
      updateProfile,
    }),
    [
      user,
      loading,
      isAuthenticated,
      loginCustomer,
      loginAdmin,
      loginSupplier,
      loginDriver,
      registerCustomer,
      registerAdmin,
      logout,
      loadMe,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
