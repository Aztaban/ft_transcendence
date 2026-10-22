import { useCallback, useEffect, useRef, useState } from "react";

import { getTutorEligibility, listEligibilityRequests } from "../../api/eligibility";
import { useCurrentUser } from "../../store/CurrentUserContext";

// Wire role names (api-plan §5.8); "Hitchhiker" means tutor or head_tutor.
const HITCHHIKER_ROLES = ["tutor", "head_tutor"];

// Head Tutors and Admins get everyone's requests from the list (§10.3), so look for the user's
// own pending request, page by page.
async function hasOwnPendingRequest(userId: number) {
  for (let page = 1; ; page += 1) {
    const result = await listEligibilityRequests("pending", { page });

    if (result.results.some((request) => request.requester.id === userId)) {
      return true;
    }

    if (result.next === null) {
      return false;
    }
  }
}

// First-time Hitchhiker activation (#169, api-plan §7.2): the user holds the Hitchhiker role,
// has no eligibility and no pending eligibility request. Checked once per user, the first time
// `enabled` becomes true (the Hitchhiker workspace is opened). The user and their roles come
// from the shared /users/me/ store, which loads only once the session check says the user is
// logged in. Once dismissed ("Not now", the form sent, or the full form opened) it stays closed
// until the next page load.
function useNeedsEligibility(enabled: boolean) {
  const { user, roles } = useCurrentUser();
  const [needsEligibility, setNeedsEligibility] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const checkedUserId = useRef<number | null>(null);

  const userId = user?.id ?? null;
  const isHitchhiker = roles.some((role) => HITCHHIKER_ROLES.includes(role));

  useEffect(() => {
    if (!enabled || userId === null || !isHitchhiker || checkedUserId.current === userId) {
      return;
    }

    let active = true;

    Promise.all([getTutorEligibility(userId), hasOwnPendingRequest(userId)])
      .then(([eligibility, hasPendingRequest]) => {
        if (active) {
          checkedUserId.current = userId;
          setNeedsEligibility(eligibility.length === 0 && !hasPendingRequest);
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

  const dismiss = useCallback(() => setIsDismissed(true), []);

  return { needsEligibility: needsEligibility && !isDismissed, dismiss };
}

export default useNeedsEligibility;
