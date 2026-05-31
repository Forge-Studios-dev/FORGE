import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errors: unknown = null;
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        const rawMessage = resp.message;
        message =
          typeof rawMessage === 'string' || Array.isArray(rawMessage)
            ? rawMessage
            : message;
        errors = resp.errors || null;
        if (typeof resp.code === 'string') code = resp.code;
      }
    } else if (exception instanceof Error) {
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(exception);
      }
      this.logger.error(
        JSON.stringify({
          msg: 'unhandled_exception',
          correlationId: request.correlationId,
          path: request.url,
          error: exception.message,
          stack: exception.stack,
        }),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: request.correlationId,
    });
  }
}
