"use client";

import { createContext, useContext } from "react";

export interface HqUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const HqUserContext = createContext<HqUser | null>(null);

/** The logged-in user, provided by the HQ layout. */
export function useHqUser(): HqUser {
  const user = useContext(HqUserContext);
  if (!user) throw new Error("useHqUser must be used inside the HQ layout");
  return user;
}
