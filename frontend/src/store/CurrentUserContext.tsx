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
  // PATCH /users/me/ (204, §10.2), then re-fetch, so every reader of `user` sees the change.
  // Rejects when either request fails; the previous profile is kept until a later load.
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
  // Read at call time, so a save that finishes after a logout does not fetch without a session.
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Resolves to whether the profile was fetched. An answer that a newer request has overtaken
  // counts as fetched: the newer one shows the result.
  const load = useCallback(async () => {
    if (!isAuthenticatedRef.current) {
      return false;
    }

    const id = ++requestId.current;

    try {
      const profile = await getCurrentUser();

      if (id === requestId.current) {
        setUser(profile);
        setIsLoaded(true);
        setLoadFailed(false);

        // The language saved in the profile wins over this device's choice (#309).
        if (isLanguage(profile.language)) {
          changeLanguage(profile.language);
        }
      }

      return true;
    } catch {
      if (id === requestId.current) {
        // Keep what was loaded before; the next refresh tries again.
        setLoadFailed(true);
      }

      return false;
    }
  }, []);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const update = useCallback(
    async (payload: UpdateUserProfilePayload) => {
      await updateCurrentUser(payload);

      // Saved, but not shown: the caller must not report success for a profile nobody can see.
      if (!(await load())) {
        throw new Error("The profile was saved but could not be re-fetched.");
      }
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
      value={{ user, roles: roleNames(user), isLoaded, loadFailed, update }}
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
  update: () => Promise.reject(new Error("No CurrentUserProvider above this component.")),
};

// Without a provider (e.g. in component tests) nothing is loaded.
export function useCurrentUser(): CurrentUserValue {
  return useContext(CurrentUserContext) ?? noCurrentUser;
}
