import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { http } from "../api/http.jsx";
import { clearTokens, getAccessToken, setTokens } from "../lib/storage.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(user);

  const loadMe = async () => {
    try {
      const response = await http.get("/api/auth/me/");
      setUser(response.data);
    } catch {
      clearTokens();
      setUser(null);
    }
  };

  const loginByPath = async (path, credentials) => {
    const loginRes = await axios.post(`${API_BASE_URL}${path}`, credentials);
    setTokens({
      access: loginRes.data.access,
      refresh: loginRes.data.refresh,
    });
    setUser(loginRes.data.user);
    return loginRes.data.user;
  };

  const loginCustomer = (credentials) => loginByPath("/api/auth/login/", credentials);
  const loginAdmin = (credentials) => loginByPath("/api/auth/admin/login/", credentials);
  const loginSupplier = (credentials) => loginByPath("/api/auth/supplier/login/", credentials);
  const loginDriver = (credentials) => loginByPath("/api/auth/driver/login/", credentials);

  const registerCustomer = async (payload) => {
    await axios.post(`${API_BASE_URL}/api/auth/register/`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const registerAdmin = async (payload) => {
    await axios.post(`${API_BASE_URL}/api/auth/admin/register/`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const updateProfile = async (payload) => {
    const response = await http.patch("/api/auth/me/", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUser(response.data);
    return response.data;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

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
  }, []);

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
    [user, loading, isAuthenticated]
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
