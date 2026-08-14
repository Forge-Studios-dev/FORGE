import { validateSync } from 'class-validator';
import { UpdateInterestsDto, UpdatePrivacyDto } from './user-preferences.dto';

describe('user preferences DTOs', () => {
  it('rejects non-boolean privacy values', () => {
    const dto = Object.assign(new UpdatePrivacyDto(), {
      watchHistoryPaused: 'yes',
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects malformed interest ids', () => {
    const dto = Object.assign(new UpdateInterestsDto(), {
      categoryIds: ['not-a-uuid'],
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects oversized interest arrays', () => {
    const dto = Object.assign(new UpdateInterestsDto(), {
      categoryIds: Array.from({ length: 21 }, (_, i) =>
        `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      ),
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
