/** Roles come from the authenticated /me or login response, never URL parameters. */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "city_staff_admin" || role === "staff" || role === "admin";
}