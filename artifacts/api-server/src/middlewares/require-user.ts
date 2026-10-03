import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { isStaffRole } from "../lib/roles";

export const requireUser: RequestHandler = async (req, res, next): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const [user] = await db.select({
    id: usersTable.id, username: usersTable.username, role: usersTable.role,
  }).from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized access. Please log in to continue." });
    return;
  }
  req.authUser = user;
  next();
};

export const requireStaff: RequestHandler = (req, res, next): void => {
  if (!isStaffRole(req.authUser?.role)) {
    res.status(403).json({ error: "Unauthorized access" });
    return;
  }
  next();
};