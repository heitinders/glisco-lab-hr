import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const user = await db.user.findUnique({
    where: { email: 'admin@gliscolab.com' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      loginAttempts: true,
      lockedUntil: true,
      employee: { select: { id: true, companyId: true } },
    },
  });

  if (!user) {
    console.log('User NOT found in database');
    process.exit(1);
  }

  console.log('User found:', {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hasPassword: !!user.passwordHash,
    loginAttempts: user.loginAttempts,
    lockedUntil: user.lockedUntil,
    employeeId: user.employee?.id,
    companyId: user.employee?.companyId,
  });

  if (user.passwordHash) {
    const match = await bcrypt.compare('Admin@123', user.passwordHash);
    console.log('Password matches:', match);
  }

  // Reset lockout if locked
  if (user.loginAttempts > 0 || user.lockedUntil) {
    await db.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    console.log('Reset login attempts and lockout');
  }

  process.exit(0);
}

main();
