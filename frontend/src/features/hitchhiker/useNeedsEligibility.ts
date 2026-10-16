import { useEffect, useRef, useState } from "react";

import { getTutorEligibility, listEligibilityRequests } from "../../api/eligibility";
import { useCurrentUser } from "../../store/CurrentUserContext";

// Wire role names (api-plan §5.8); "Hitchhiker" means tutor or head_tutor.
const HITCHHIKER_ROLES = ["tutor", "head_tutor"];

// First-time Hitchhiker activation (#169, api-plan §7.2): the user holds the Hitchhiker role,
// has no eligibility and no pending eligibility request. Checked once per user, the first time
// `enabled` becomes true (the Hitchhiker workspace is opened). The user and their roles come
// from the shared /users/me/ store, which loads only once the session check says the user is
// logged in.
function useNeedsEligibility(enabled: boolean) {
  const { user, roles } = useCurrentUser();
  const [needsEligibility, setNeedsEligibility] = useState(false);
  const checkedUserId = useRef<number | null>(null);

  const userId = user?.id ?? null;
  const isHitchhiker = roles.some((role) => HITCHHIKER_ROLES.includes(role));

  useEffect(() => {
    if (!enabled || userId === null || !isHitchhiker || checkedUserId.current === userId) {
      return;
    }

    let active = true;

    Promise.all([getTutorEligibility(userId), listEligibilityRequests("pending")])
      .then(([eligibility, pending]) => {
        if (active) {
          checkedUserId.current = userId;
          setNeedsEligibility(eligibility.length === 0 && pending.count === 0);
        }
      })
      .catch(() => {
        // Not being able to check is not an error for the user: the form stays reachable
        // from the Requests page ("Request more projects").
      });

    return () => {
      active = false;
    };
  }, [enabled, userId, isHitchhiker]);

  return { needsEligibility, dismiss: () => setNeedsEligibility(false) };
}

export default useNeedsEligibility;
