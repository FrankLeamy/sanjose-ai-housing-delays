import type { ErrorRequestHandler } from "express";

const requestErrors: Record<string, { status: number; message: string }> = {
  "entity.parse.failed": { status: 400, message: "Invalid JSON or request body." },
  "entity.too.large": { status: 413, message: "Request body is too large." },
  "encoding.unsupported": { status: 415, message: "Unsupported request encoding." },
  "charset.unsupported": { status: 415, message: "Unsupported request character set." },
  "request.aborted": { status: 400, message: "Request was interrupted." },
  "request.size.invalid": { status: 400, message: "Invalid request size." },
  "parameters.too.many": { status: 413, message: "Too many request parameters." },
};

export const apiErrorHandler: ErrorRequestHandler = (error: unknown, req, res, next): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const type =
    typeof error === "object" && error !== null && "type" in error &&
    typeof error.type === "string"
      ? error.type
      : undefined;
  const requestError = type && Object.hasOwn(requestErrors, type) ? requestErrors[type] : undefined;
  if (requestError) {
    res.status(requestError.status).json({ error: requestError.message });
    return;
  }

  // Do not log parser bodies or echo internal exception messages to the client.
  req.log?.error({ errorType: type ?? "internal" }, "Unhandled API error");
  res.status(500).json({ error: "An unexpected server error occurred." });
};