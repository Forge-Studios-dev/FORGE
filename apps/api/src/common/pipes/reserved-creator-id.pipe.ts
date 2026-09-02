import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Literal path segments reserved for authenticated creator shortcuts (`/creators/me/...`). */
const RESERVED_CREATOR_IDS = new Set(['me']);

/**
 * Rejects `creatorId=me` on `/creators/:creatorId/...` consumer routes so a mis-ordered
 * controller cannot treat the shortcut as a real id.
 */
@Injectable()
export class ReservedCreatorIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (RESERVED_CREATOR_IDS.has(value)) {
      throw new BadRequestException(
        'Invalid creator id — use /creators/me/... for the authenticated creator',
      );
    }
    return value;
  }
}
