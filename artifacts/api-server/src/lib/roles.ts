/** Only database-loaded roles may be passed to authorization checks. */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "city_staff_admin" || role === "staff" || role === "admin";
}