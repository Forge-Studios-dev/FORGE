import { BadRequestException } from '@nestjs/common';
import { ReservedCreatorIdPipe } from './reserved-creator-id.pipe';

describe('ReservedCreatorIdPipe', () => {
  const pipe = new ReservedCreatorIdPipe();

  it('passes through normal creator ids', () => {
    expect(pipe.transform('creator-uuid-123')).toBe('creator-uuid-123');
  });

  it('rejects the reserved "me" shortcut', () => {
    expect(() => pipe.transform('me')).toThrow(BadRequestException);
  });
});
