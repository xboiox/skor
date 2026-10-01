import { fail, toAppError } from "@/lib/api-response";
import { logger } from "@/server/logger";

type RouteHandler<Req extends Request, Ctx> = (request: Req, context: Ctx) => Promise<Response>;

export function withErrorHandling<Req extends Request, Ctx>(
  handler: RouteHandler<Req, Ctx>,
): RouteHandler<Req, Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      const appError = toAppError(err);
      if (appError.code === "INTERNAL_ERROR") {
        logger.error("Unhandled route error", {
          error: err,
          method: request.method,
          url: request.url,
        });
      }
      return fail(appError);
    }
  };
}
