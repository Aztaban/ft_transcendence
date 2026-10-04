import { createContext, useContext, useState, type ReactNode } from "react";

export const roles = ["STUDENT", "HITCHHIKER", "COUNCIL"] as const;

export type AppRole = (typeof roles)[number];

interface RoleContextValue {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [activeRole, setActiveRole] = useState<AppRole>("STUDENT");

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);

  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }

  return context;
}
