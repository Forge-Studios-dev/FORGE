import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_BY_TYPE,
  categoryForNotificationType,
  isCategoryMuted,
} from './notification-preferences';
import type { NotificationType } from './domain';

describe('categoryForNotificationType', () => {
  it('maps every known notification type to a valid category', () => {
    for (const [type, category] of Object.entries(NOTIFICATION_CATEGORY_BY_TYPE)) {
      expect(categoryForNotificationType(type as NotificationType)).toBe(category);
      expect(NOTIFICATION_CATEGORIES).toContain(category);
    }
  });

  it('falls back to social for an unknown type', () => {
    expect(categoryForNotificationType('made_up_type')).toBe('social');
  });
});

describe('isCategoryMuted', () => {
  it('is false when preferences are missing', () => {
    expect(isCategoryMuted(null, 'social')).toBe(false);
    expect(isCategoryMuted(undefined, 'social')).toBe(false);
  });

  it('is false when the category is not in the muted list', () => {
    expect(isCategoryMuted({ mutedCategories: ['live'], emailDigest: false }, 'social')).toBe(false);
  });

  it('is true when the category is muted', () => {
    expect(isCategoryMuted({ mutedCategories: ['social', 'live'], emailDigest: false }, 'social')).toBe(true);
  });
});
