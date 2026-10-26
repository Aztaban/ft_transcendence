import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { getCurrentUser } from "../api/users";
import { changeLanguage, isLanguage } from "../i18n";
import type { UserProfile } from "../types/user";
import { useLiveRefresh } from "../websocket/LiveProvider";
import { useAuth } from "./AuthContext";

interface CurrentUserValue {
  user: UserProfile | null;
  // Wire role names (api-plan §5.8): "student", "tutor", "head_tutor", "sc_member", "admin".
  roles: string[];
  // True once /users/me/ has answered for the logged-in user.
  isLoaded: boolean;
  refresh: () => void;
}

const CurrentUserContext = createContext<CurrentUserValue | undefined>(undefined);

function roleNames(user: UserProfile | null) {
  return user ? user.roles.map((role) => role.name) : [];
}

interface CurrentUserProviderProps {
  children: ReactNode;
}

// The logged-in user's profile and real roles, from GET /users/me/. Loaded only once the
// session check says the user is logged in, and re-fetched on the WebSocket event
// `role.changed` so the navigation is rebuilt (api-plan §9.3).
export function CurrentUserProvider({ children }: CurrentUserProviderProps) {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useLiveRefresh(["role.changed"], refresh);

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      setIsLoaded(false);
      return;
    }

    let active = true;

    getCurrentUser()
      .then((profile) => {
        if (active) {
          setUser(profile);
          setIsLoaded(true);

          // The language saved in the profile wins over this device's choice (#309).
          if (isLanguage(profile.language)) {
            changeLanguage(profile.language);
          }
        }
      })
      .catch(() => {
        // Keep what was loaded before; the next refresh tries again.
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, reloadKey]);

  return (
    <CurrentUserContext.Provider value={{ user, roles: roleNames(user), isLoaded, refresh }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

const noCurrentUser: CurrentUserValue = {
  user: null,
  roles: [],
  isLoaded: false,
  refresh: () => {},
};

// Without a provider (e.g. in component tests) nothing is loaded.
export function useCurrentUser(): CurrentUserValue {
  return useContext(CurrentUserContext) ?? noCurrentUser;
}
