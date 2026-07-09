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

export default useAuthStore;
