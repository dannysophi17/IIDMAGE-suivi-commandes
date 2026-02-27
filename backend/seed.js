require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
  const prisma = new PrismaClient();

  const email = process.env.ADMIN_EMAIL || 'admin@iidmage.local';
  const rawPassword = process.env.ADMIN_PASSWORD || 'change_me123';

  const existing = await prisma.user.findUnique({ where: { email } });
  const hashed = await bcrypt.hash(rawPassword, 10);

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        password: hashed,
        name: existing.name || 'Owner',
        role: 'OWNER'
      }
    });
    console.log('Updated owner user:', email);
    console.log('Password updated from ADMIN_PASSWORD in .env');
    process.exit(0);
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: 'Owner',
      role: 'OWNER'
    }
  });

  console.log('Created owner user:', user.email);
  console.log('Password set from ADMIN_PASSWORD in .env');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
