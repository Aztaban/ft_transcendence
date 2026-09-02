import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  db: string;
  redis: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health/`)
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>ft_transcendence</h1>
      <p>Docker dev environment bootstrap — proves frontend ↔ backend ↔ db/redis wiring.</p>
      {error && <p style={{ color: "red" }}>Backend unreachable: {error}</p>}
      {health && (
        <pre>{JSON.stringify(health, null, 2)}</pre>
      )}
    </main>
  );
}
