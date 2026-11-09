import { useEffect } from "react";

// Calls `refresh` whenever the browser tab is shown again. Some changes send no event, such as a
// colleague marking a council message read, so pages that show them load again then (§9.4).
function useRefreshWhenVisible(refresh: () => void) {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);
}

export default useRefreshWhenVisible;
