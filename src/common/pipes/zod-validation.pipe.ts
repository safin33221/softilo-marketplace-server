import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { type ZodSchema } from 'zod';

/**
 * Reusable Pipe that validates incoming HTTP request body/params using Zod schemas.
 * Throws a clean 400 BadRequestException with specific field errors.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors,
      });
    }
    return result.data;
  }
}

