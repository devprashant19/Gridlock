/**
 * Envio HyperIndex GraphQL Client for Gridlock Frontend
 */

export const ENVIO_GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_ENVIO_GRAPHQL || "http://localhost:8080/v1/graphql";

export interface ProviderRecord {
  id: string;
  name: string;
  passes: number;
  degraded: number;
  fails: number;
  timeouts: number;
  hoursDelivered: string;
  slashedTotal: string;
}

export const PROVIDERS_LEADERBOARD_QUERY = `
  query GetProviderLeaderboard {
    Provider(order_by: { fails: asc, passes: desc }) {
      id
      name
      passes
      degraded
      fails
      timeouts
      hoursDelivered
      slashedTotal
    }
  }
`;

export async function fetchProviderLeaderboard(): Promise<ProviderRecord[]> {
  try {
    const res = await fetch(ENVIO_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: PROVIDERS_LEADERBOARD_QUERY }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(JSON.stringify(json.errors));
    }

    return (json.data?.Provider || []).map((p: any) => ({
      ...p,
      // Format 6 decimals for slashedTotal (GridUSD)
      slashedTotal: (Number(p.slashedTotal || 0) / 1e6).toFixed(2),
      hoursDelivered: Number(p.hoursDelivered || 0).toString(),
    }));
  } catch (err) {
    console.warn("Envio indexer unavailable, using local mock data fallback:", err);
    return [];
  }
}
