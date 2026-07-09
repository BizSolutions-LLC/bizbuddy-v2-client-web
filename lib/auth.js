// lib/auth.js

import { jwtDecode } from "jwt-decode";

export async function getUserFromRequest(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwtDecode(token);

    return decoded;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
}
