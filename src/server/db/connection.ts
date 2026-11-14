/** How to connect to a database address. Kept apart from the client so scripts can reuse it. */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db", "postgres"]);

/** A database address with the password hidden, safe to print. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(unreadable address)";
  }
}

export function isLocalDatabase(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Connections to a database on the internet are always encrypted. A local
 * database (your own computer, or the test one) is not.
 */
export function connectionOptions(url: string) {
  return {
    // "prepare: false" keeps us compatible with pooled connections (e.g. Supabase).
    prepare: false,
    onnotice: () => {},
    ...(isLocalDatabase(url) ? {} : { ssl: "require" as const }),
  };
}
