// components/system-admin/SystemAdminContext.jsx
//
// BB-110: the signed-in system admin ({ id, username, name, isOwner,
// twoFactorEnabled, ... } from /auth/verify), shared with the nav and pages.

"use client";

import { createContext, useContext } from "react";

const SystemAdminContext = createContext({ admin: null, refreshAdmin: () => {} });

export const SystemAdminProvider = SystemAdminContext.Provider;

export function useSystemAdmin() {
  return useContext(SystemAdminContext);
}
