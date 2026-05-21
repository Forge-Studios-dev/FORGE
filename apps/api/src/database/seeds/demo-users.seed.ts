import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { CreatorStatus, User, UserRole } from '../../modules/users/entities/user.entity';

/** Local demo accounts documented in docs/mvp-test-matrix.md */
const DEMO_USERS: Array<{
  email: string;
  password: string;
  username: string;
  displayName: string;
  role: UserRole;
  isVerified: boolean;
  creatorStatus: CreatorStatus | null;
}> = [
  {
    email: 'viewer@forge.local',
    password: 'ForgeDemo123!',
    username: 'forgeviewer',
    displayName: 'Forge Viewer',
    role: UserRole.USER,
    isVerified: true,
    creatorStatus: null,
  },
  {
    email: 'creator@forge.local',
    password: 'ForgeDemo123!',
    username: 'forgecreator',
    displayName: 'Forge Creator',
    role: UserRole.CREATOR,
    isVerified: true,
    creatorStatus: CreatorStatus.APPROVED,
  },
  {
    email: 'admin@forge.local',
    password: 'ForgeAdmin123!',
    username: 'forgeadmin',
    displayName: 'Forge Admin',
    role: UserRole.ADMIN,
    isVerified: true,
    creatorStatus: null,
  },
];

export async function seedDemoUsers(dataSource: DataSource) {
  const repo = dataSource.getRepository(User);
  const rounds = 12;

  for (const demo of DEMO_USERS) {
    const email = demo.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(demo.password, rounds);
    let user = await repo.findOne({ where: { email } });

    const reviewedAt =
      demo.creatorStatus === CreatorStatus.APPROVED ? new Date() : null;

    if (!user) {
      user = repo.create({
        email,
        username: demo.username,
        displayName: demo.displayName,
        passwordHash,
        role: demo.role,
        isVerified: demo.isVerified,
        creatorStatus: demo.creatorStatus,
        creatorRequestedAt: demo.creatorStatus ? new Date() : null,
        creatorReviewedAt: reviewedAt,
        creatorReviewNote: null,
        followerCount: 0,
        followingCount: 0,
        videoCount: 0,
      });
    } else {
      user.username = demo.username;
      user.displayName = demo.displayName;
      user.passwordHash = passwordHash;
      user.role = demo.role;
      user.isVerified = demo.isVerified;
      user.creatorStatus = demo.creatorStatus;
      user.creatorRequestedAt = demo.creatorStatus ? user.creatorRequestedAt ?? new Date() : null;
      user.creatorReviewedAt = reviewedAt;
      user.creatorReviewNote = null;
    }

    await repo.save(user);
    console.log(`✓ Demo user ${email} (${demo.role})`);
  }
}
