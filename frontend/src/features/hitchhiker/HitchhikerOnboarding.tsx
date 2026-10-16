import { useEffect } from "react";
import { useLocation } from "react-router";

import { useRole } from "../../store/RoleContext";
import useNeedsEligibility from "./useNeedsEligibility";
import WelcomeHitchhikerDialog from "./WelcomeHitchhikerDialog";

const ELIGIBILITY_PAGE = "/eligibility-requests/new";

// Opens the "Welcome Hitchhiker" popup the first time a Hitchhiker without eligibility opens
// their workspace (#169). Not on the eligibility page itself, which has the same form.
function HitchhikerOnboarding() {
  const { activeRole } = useRole();
  const { pathname } = useLocation();
  const { needsEligibility, dismiss } = useNeedsEligibility(activeRole === "HITCHHIKER");
  const isOnEligibilityPage = pathname === ELIGIBILITY_PAGE;

  // The user opened the full form: the popup does not come back in this session, whether the
  // request is sent there or not (like "Not now"; after a reload it shows again until a request
  // is pending).
  useEffect(() => {
    if (isOnEligibilityPage) {
      dismiss();
    }
  }, [isOnEligibilityPage, dismiss]);

  if (!needsEligibility || activeRole !== "HITCHHIKER" || isOnEligibilityPage) {
    return null;
  }

  return <WelcomeHitchhikerDialog onClose={dismiss} />;
}

export default HitchhikerOnboarding;
