import type { RequestHandler } from "express";

/** Prevent shared caches and cross-origin browser writes from reusing private sessions. */
export const privateApi: RequestHandler = (req, res, next): void => {
  res.set("Cache-Control", "private, no-store");
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  const origin = req.get("origin");
  const host = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host");
  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "Unauthorized access" }); return;
  }
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(`${req.protocol}://${host}`).origin) {
        res.status(403).json({ error: "Unauthorized access" }); return;
      }
    } catch {
      res.status(403).json({ error: "Unauthorized access" }); return;
    }
  }
  next();
};