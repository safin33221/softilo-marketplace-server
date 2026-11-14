import { PipeTransform, Injectable, BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { type ZodSchema } from 'zod';

/**
 * Reusable Pipe that validates incoming HTTP request body/params using Zod schemas.
 * Safely skips custom decorator parameters (e.g. @CurrentUser(), @Req()).
 * Throws a clean 400 BadRequestException with specific field errors.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata?: ArgumentMetadata) {
    // Only validate intended HTTP payloads. Skip custom decorators (like @CurrentUser(), @Req())
    // and skip route parameters (@Param('id')) so object body schemas are not mistakenly run on string params.
    if (metadata && (metadata.type === 'custom' || (metadata.type === 'param' && typeof value === 'string'))) {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      const primaryMessage = errors[0]?.message || 'Validation failed';

      throw new BadRequestException({
        statusCode: 400,
        message: primaryMessage,
        errors,
      });
    }
    return result.data;
  }
}


