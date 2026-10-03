import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: { id: number; username: string; role: "resident" | "city_staff_admin" };
    }
  }
}