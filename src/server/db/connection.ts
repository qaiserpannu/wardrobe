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

/**
 * Spots a database address that was pasted wrongly, before we try to use it.
 * Returns a plain-language explanation, or null when the address looks whole.
 * Never includes the password.
 */
export function databaseAddressProblem(url: string): string | null {
  const symbols =
    "This usually means the password contains a symbol such as # / ? @ or : which breaks the address. " +
    "Reset the database password to one with only letters and numbers, then put the new password in the address.";
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return `The address cannot be read. ${symbols}`;
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) return 'The address must start with "postgresql://".';
  if (/\[|\]|YOUR-PASSWORD/i.test(url)) {
    return 'The address still contains the "[YOUR-PASSWORD]" placeholder. Replace it, including the square brackets, with the database password.';
  }
  // A whole address ends with a server name, then "/" and the database name.
  if (parsed.pathname.length < 2 || (!isLocalDatabase(url) && !parsed.hostname.includes(".")) || /^postgres\.[a-z0-9]+$/.test(parsed.hostname)) {
    return `The address is cut short: it stops at "${parsed.hostname}" instead of ending with the server name and "/postgres". ${symbols}`;
  }
  if (!isLocalDatabase(url) && !parsed.password) return "The address has no password in it.";
  return null;
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
