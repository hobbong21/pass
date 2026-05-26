/**
 * DB 상태 점검 스크립트 — 각 테이블 레코드 수와 시드 데이터 무결성 확인
 *   사용법: npx ts-node test/db-state.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const authCodes = await prisma.authCode.count();
  const refreshTokens = await prisma.refreshToken.count();
  const devicePins = await prisma.devicePin.count();
  const contactLinks = await prisma.contactLink.count();
  const relations = await prisma.relation.count();
  const posts = await prisma.post.count();
  const postLikes = await prisma.postLike.count();
  const postComments = await prisma.postComment.count();
  const conversations = await prisma.conversation.count();
  const messages = await prisma.message.count();

  const rows: Array<[string, number]> = [
    ['users', users],
    ['auth_codes', authCodes],
    ['refresh_tokens', refreshTokens],
    ['device_pins', devicePins],
    ['contact_links', contactLinks],
    ['relations', relations],
    ['posts', posts],
    ['post_likes', postLikes],
    ['post_comments', postComments],
    ['conversations', conversations],
    ['messages', messages],
  ];

  console.log('\n📊 DB 상태 (file:./dev.db)\n');
  console.log('┌─────────────────────┬──────────┐');
  console.log('│ Table               │  Records │');
  console.log('├─────────────────────┼──────────┤');
  for (const [name, count] of rows) {
    console.log(`│ ${name.padEnd(20)}│ ${String(count).padStart(8)} │`);
  }
  console.log('└─────────────────────┴──────────┘\n');

  // 시드 무결성 — 데모 계정 + 비밀번호 해시 + PIN
  console.log('🔍 시드 무결성 검사');
  const demo = await prisma.user.findUnique({ where: { email: 'demo@chon.ai' } });
  if (!demo) {
    console.log('  ❌ demo@chon.ai 가 없음 — npm run prisma:seed 실행 필요');
  } else {
    console.log(`  ✅ demo@chon.ai (id=${demo.id})`);
    console.log(`     passwordHash: ${demo.passwordHash ? '있음 (' + demo.passwordHash.length + ' chars)' : '❌ 없음'}`);
    console.log(`     phone: ${demo.phone}`);
    const pin = await prisma.devicePin.findUnique({
      where: { userId_deviceId: { userId: demo.id, deviceId: 'demo-device' } },
    });
    console.log(`     데모 PIN: ${pin ? '✅ 등록됨 (hash ' + pin.pinHash.length + ' chars)' : '❌ 없음'}`);
  }

  // 관계 — demo가 friend 3명 + 2-hop 1명을 가져야 함
  const demoFriends = demo
    ? await prisma.relation.count({
        where: { fromUserId: demo.id, kind: 'friend', status: 'confirmed' },
      })
    : 0;
  console.log(`  · demo의 1-hop friend 관계: ${demoFriends}건 (기대 3건)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e);
  prisma.$disconnect();
  process.exit(1);
});
