import { useEffect, useState } from "react";
import { getHealth } from "../api/health";

type BackendStatus = "checking" | "connected" | "unavailable";

function HomePage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    let active = true;

    getHealth()
      .then(() => {
        if (active) {
          setBackendStatus("connected");
        }
      })
      .catch(() => {
        if (active) {
          setBackendStatus("unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <p>Frontend application initialized with React and TypeScript.</p>
      <p>Backend connection: {backendStatus}</p>
    </>
  );
}

export default HomePage;
