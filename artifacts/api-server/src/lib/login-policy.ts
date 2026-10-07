// Explicit, owner-approved legacy credential exception. This never assigns roles
// or creates accounts and does not apply to signup or staff-account creation.
const shortPasswordRoles: Readonly<Record<string, string>> = {
  User1: "resident",
  Staff1: "staff",
};

export function allowsLoginPassword(username: string, password: string): boolean {
  return password.length <= 128 && (
    password.length >= 8 ||
    Object.hasOwn(shortPasswordRoles, username) && /^[0-9]{4}$/.test(password)
  );
}

export function allowsShortPasswordRole(username: string, password: string, role: string): boolean {
  return password.length >= 8 ||
    Object.hasOwn(shortPasswordRoles, username) && shortPasswordRoles[username] === role;
}
