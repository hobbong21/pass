import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { email: 'newuser@chon.ai' } });
  if (!u) { console.log('❌ newuser@chon.ai 없음'); process.exit(1); }

  console.log('✅ DB 레코드 확인');
  console.log('  id:', u.id);
  console.log('  email:', u.email);
  console.log('  phone:', u.phone);
  console.log('  name:', u.name);
  console.log('  passwordHash:', u.passwordHash ? `있음 (${u.passwordHash.length} chars, prefix=${u.passwordHash.slice(0,7)})` : '❌ 없음');
  console.log('  phoneVerified:', u.phoneVerified);
  console.log('  status:', u.status);
  console.log('  createdAt:', u.createdAt.toISOString());

  // 발급된 refresh 토큰
  const tokens = await prisma.refreshToken.count({ where: { userId: u.id, revokedAt: null } });
  console.log('  활성 refresh 토큰:', tokens);

  // 가입 시 사용된 OTP가 consumed로 처리됐는지
  const consumed = await prisma.authCode.findFirst({
    where: { target: 'newuser@chon.ai', purpose: 'register', consumedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  console.log('  소비된 register OTP:', consumed ? `✅ ${consumed.consumedAt!.toISOString()}` : '❌ 없음');

  await prisma.$disconnect();
}
main();
