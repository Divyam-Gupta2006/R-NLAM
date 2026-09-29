import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { TransitionBlockedError } from '../lifecycle/lifecycle.types';

/**
 * One error shape for the whole API:
 *   { statusCode, error, message, blockers? }
 * Blocked lifecycle transitions become 409 with the list of blockers so the UI
 * can explain exactly what is missing.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof TransitionBlockedError) {
      res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'TRANSITION_BLOCKED',
        message: `${exception.entityType} cannot ${exception.event}: ${exception.blockers.map((b) => b.message).join(' ')}`,
        blockers: exception.blockers,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const status = exception.getStatus();
      res.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, error: HttpStatus[status], message: body }
          : { statusCode: status, error: HttpStatus[status], ...(body as object) },
      );
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        res.status(404).json({ statusCode: 404, error: 'NOT_FOUND', message: 'Record not found' });
        return;
      }
      if (exception.code === 'P2002') {
        res.status(409).json({ statusCode: 409, error: 'CONFLICT', message: `Duplicate value for ${String(exception.meta?.target ?? 'a unique field')}` });
        return;
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    res.status(500).json({ statusCode: 500, error: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error; see server log.' });
  }
}
