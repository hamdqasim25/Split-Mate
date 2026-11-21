export type AuthDestination = "/dashboard" | "/groups/new" | "/profile" | "/profile/appearance";

/** Exact destinations only, shared by server pages and browser navigation. */
export function authDestination(value: unknown): AuthDestination {
  return value === "/groups/new" || value === "/profile" || value === "/profile/appearance" ? value : "/dashboard";
}
