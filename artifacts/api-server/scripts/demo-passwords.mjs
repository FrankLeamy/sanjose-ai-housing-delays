import { randomInt } from "node:crypto";

// Development demo passwords only. Real-user authentication policy is unchanged.
// Lowercase letters and digits, omitting easily confused characters.
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateDemoPasswords(count) {
  const passwords = new Set();
  while (passwords.size < count) {
    const password = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
    if (/[a-z]/.test(password) && /[0-9]/.test(password)) passwords.add(password);
  }
  return [...passwords];
}