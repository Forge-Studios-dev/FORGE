import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { productionCorsOrigins } from '../../config/cors-origins';

/** Loopback origins allowed in non-production so local/dev checkout flows keep working. */
const DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Restricts a URL field to FORGE's own web/admin origins (plus localhost outside
 * production). Prevents Stripe checkout/portal redirect targets from being pointed
 * at an arbitrary attacker-controlled host (MED-02).
 */
@ValidatorConstraint({ name: 'isAllowedRedirectUrl', async: false })
class IsAllowedRedirectUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    let origin: string;
    try {
      origin = new URL(value).origin;
    } catch {
      return false;
    }

    const allowedOrigins = productionCorsOrigins();
    if (allowedOrigins.includes(origin)) return true;
    if (process.env.NODE_ENV !== 'production' && DEV_ORIGIN_PATTERN.test(origin)) return true;
    return false;
  }

  defaultMessage(): string {
    return 'must be an absolute URL on a FORGE web/admin origin';
  }
}

export function IsAllowedRedirectUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAllowedRedirectUrlConstraint,
    });
  };
}
