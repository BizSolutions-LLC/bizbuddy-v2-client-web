// store/useAuthStore.js

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jwtDecode } from "jwt-decode";

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      isHydrated: false,
      sidebarOpen: false,
      login: (token) => {
        set({ token });
      },
      logout: () => {
        set({ token: null });
      },
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      get user() {
        const { token } = get();
        if (!token) {
          return null;
        }
        try {
          const decoded = jwtDecode(token);
          return decoded;
        } catch (err) {
          return null;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);

export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    if (!decoded?.exp) return false;
    return decoded.exp * 1000 <= Date.now();
  } catch (err) {
    return true;
  }
}

export default useAuthStore;
