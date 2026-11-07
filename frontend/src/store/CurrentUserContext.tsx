import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser, updateCurrentUser, type UpdateUserProfilePayload } from "../api/users";
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
  // True when the last GET /users/me/ failed; with `user` still null nothing can be shown.
  loadFailed: boolean;
  refresh: () => void;
  // PATCH /users/me/ (204, §10.2), then re-fetch, so every reader of `user` sees the change.
  // Rejects when the PATCH fails; a failed re-fetch keeps the previous profile.
  update: (payload: UpdateUserProfilePayload) => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserValue | undefined>(undefined);

function roleNames(user: UserProfile | null) {
  return user ? user.roles.map((role) => role.name) : [];
}

interface CurrentUserProviderProps {
  children: ReactNode;
}

// The single owner of the logged-in user's profile and real roles, from GET /users/me/. Loaded
// only once the session check says the user is logged in, re-fetched on the WebSocket event
// `role.changed` (api-plan §9.3) and after every `update`. Pages read it; none keeps a copy.
export function CurrentUserProvider({ children }: CurrentUserProviderProps) {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Only the newest request may set state: a logout or a later load wins over an older answer.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;

    try {
      const profile = await getCurrentUser();

      if (id !== requestId.current) {
        return;
      }

      setUser(profile);
      setIsLoaded(true);
      setLoadFailed(false);

      // The language saved in the profile wins over this device's choice (#309).
      if (isLanguage(profile.language)) {
        changeLanguage(profile.language);
      }
    } catch {
      if (id === requestId.current) {
        // Keep what was loaded before; the next refresh tries again.
        setLoadFailed(true);
      }
    }
  }, []);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const update = useCallback(
    async (payload: UpdateUserProfilePayload) => {
      await updateCurrentUser(payload);
      await load();
    },
    [load],
  );

  useLiveRefresh(["role.changed"], refresh);

  useEffect(() => {
    if (!isAuthenticated) {
      requestId.current += 1;
      setUser(null);
      setIsLoaded(false);
      setLoadFailed(false);
      return;
    }

    void load();
  }, [isAuthenticated, reloadKey, load]);

  return (
    <CurrentUserContext.Provider
      value={{ user, roles: roleNames(user), isLoaded, loadFailed, refresh, update }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

const noCurrentUser: CurrentUserValue = {
  user: null,
  roles: [],
  isLoaded: false,
  loadFailed: false,
  refresh: () => {},
  update: () => Promise.resolve(),
};

// Without a provider (e.g. in component tests) nothing is loaded.
export function useCurrentUser(): CurrentUserValue {
  return useContext(CurrentUserContext) ?? noCurrentUser;
}
