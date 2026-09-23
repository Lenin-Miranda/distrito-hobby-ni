import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const messages: Record<number, string> = {
      400: "Bad request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not found",
      405: "Method not allowed",
      429: "Too many requests",
    };
    if (statusCode >= 500) this.logger.error(`HTTP failure (${statusCode})`);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({
        statusCode,
        message:
          statusCode >= 500
            ? "Internal server error"
            : (messages[statusCode] ?? "Request failed"),
      });
  }
}
