import { Router, type IRouter, type Request } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  LogInBody,
  LogInResponse,
  SignUpBody,
  SignUpResponse,
} from "@workspace/api-zod";
import { isStaffRole } from "../lib/roles";

const router: IRouter = Router();

async function startSession(req: Request, userId: number): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.userId = userId;
  await new Promise<void>((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
}

router.post("/signup", async (req, res): Promise<void> => {
  const input = SignUpBody.strict().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Use a username of 3–30 letters, numbers or underscores and a password of 8–128 characters." });
    return;
  }

  const username = input.data.username;
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
  if (existing) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }

  const passwordHash = await bcrypt.hash(input.data.password, 12);
  let user: typeof usersTable.$inferSelect;
  try {
    [user] = await db.insert(usersTable).values({ username, passwordHash, role: "resident" }).returning();
  } catch (error) {
    if (typeof error === "object" && error !== null &&
        ("code" in error && error.code === "23505" ||
         "cause" in error && typeof error.cause === "object" && error.cause !== null &&
         "code" in error.cause && error.cause.code === "23505")) {
      res.status(409).json({ error: "That username is already taken." });
      return;
    }
    throw error;
  }

  await startSession(req, user.id);
  res.status(201).json(SignUpResponse.parse(user));
});

router.post("/login", async (req, res): Promise<void> => {
  const input = LogInBody.strict().safeParse(req.body);
  if (!input.success) {
    res.status(401).json({ error: "Incorrect username or password." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, input.data.username));
  if (!user || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Incorrect username or password." });
    return;
  }
  const accountType = isStaffRole(user.role) ? "city_staff" : user.role === "resident" ? "resident" : null;
  if (!accountType || (input.data.accountType && input.data.accountType !== accountType)) {
    res.status(403).json({ error: "This account does not match the selected account type. Choose the correct type and try again." });
    return;
  }
  await startSession(req, user.id);
  res.json(LogInResponse.parse(user));
});

router.post("/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((error) => (error ? reject(error) : resolve())),
  );
  res.clearCookie("permit.sid", { path: "/" });
  res.sendStatus(204);
});

router.get("/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(GetMeResponse.parse(null));
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  res.json(GetMeResponse.parse(user ?? null));
});

export default router;