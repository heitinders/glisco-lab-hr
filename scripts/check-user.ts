import { db } from '../src/lib/db';

async function main() {
  const user = await db.user.findUnique({
    where: { email: 'admin@gliscolab.com' },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });

  if (!user) {
    console.log('User NOT found in database');
  } else {
    console.log('User found:', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasPassword: !!user.passwordHash,
      hashPrefix: user.passwordHash?.substring(0, 7),
    });
  }

  // Also try bcrypt compare
  if (user?.passwordHash) {
    const bcrypt = await import('bcryptjs');
    const match = await bcrypt.compare('Admin@123', user.passwordHash);
    console.log('Password matches:', match);
  }

  process.exit(0);
}

main();
