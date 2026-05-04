export interface PaginationResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

export interface CursorPaginationDto {
  cursor?: string;
  limit?: number;
}

export function decodeCursor(cursor: string): Date {
  return new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
}

export function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64');
}
