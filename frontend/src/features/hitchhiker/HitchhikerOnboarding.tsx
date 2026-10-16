import { useLocation } from "react-router";

import { useRole } from "../../store/RoleContext";
import useNeedsEligibility from "./useNeedsEligibility";
import WelcomeHitchhikerDialog from "./WelcomeHitchhikerDialog";

// Opens the "Welcome Hitchhiker" popup the first time a Hitchhiker without eligibility opens
// their workspace (#169). Not on the eligibility page itself, which has the same form.
function HitchhikerOnboarding() {
  const { activeRole } = useRole();
  const { pathname } = useLocation();
  const { needsEligibility, dismiss } = useNeedsEligibility(activeRole === "HITCHHIKER");

  if (
    !needsEligibility ||
    activeRole !== "HITCHHIKER" ||
    pathname === "/eligibility-requests/new"
  ) {
    return null;
  }

  return <WelcomeHitchhikerDialog onClose={dismiss} />;
}

export default HitchhikerOnboarding;
