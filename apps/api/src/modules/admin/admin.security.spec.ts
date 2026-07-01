import 'reflect-metadata';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AdminController } from './admin.controller';

describe('AdminController security', () => {
  it('requires ADMIN role on the controller class', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController) as UserRole[] | undefined;
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('is mounted under /admin', () => {
    const path = Reflect.getMetadata('path', AdminController) as string | undefined;
    expect(path).toBe('admin');
  });

  it('exposes only admin-scoped route handlers', () => {
    const prototype = AdminController.prototype as unknown as Record<string, unknown>;
    const handlerNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function',
    );
    expect(handlerNames.length).toBeGreaterThan(10);
    for (const name of handlerNames) {
      const handler = prototype[name] as object;
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[] | undefined;
      const classRoles = Reflect.getMetadata(ROLES_KEY, AdminController) as UserRole[] | undefined;
      expect(roles ?? classRoles).toContain(UserRole.ADMIN);
    }
  });
});
