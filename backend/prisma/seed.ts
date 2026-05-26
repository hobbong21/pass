import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function main() {
  console.log('🌱 시드 데이터 생성 중...');

  // 데모 계정용 비밀번호: chon1234
  const demoPasswordHash = await bcrypt.hash('chon1234', 12);

  // ---------- 데모 사용자 ----------
  const demo = await prisma.user.upsert({
    where: { email: 'demo@chon.ai' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'demo@chon.ai',
      phone: '+821012345678',
      phoneVerified: true,
      passwordHash: demoPasswordHash,
      name: '홍길순',
    },
  });

  const friend1 = await prisma.user.upsert({
    where: { email: 'kim@chon.ai' },
    update: { passwordHash: demoPasswordHash },
    create: { email: 'kim@chon.ai', phone: '+821011111111', phoneVerified: true, passwordHash: demoPasswordHash, name: '김민수' },
  });
  const friend2 = await prisma.user.upsert({
    where: { email: 'park@chon.ai' },
    update: { passwordHash: demoPasswordHash },
    create: { email: 'park@chon.ai', phone: '+821022222222', phoneVerified: true, passwordHash: demoPasswordHash, name: '박지영' },
  });
  const friend3 = await prisma.user.upsert({
    where: { email: 'lee@chon.ai' },
    update: { passwordHash: demoPasswordHash },
    create: { email: 'lee@chon.ai', phone: '+821033333333', phoneVerified: true, passwordHash: demoPasswordHash, name: '이상호' },
  });
  const fof = await prisma.user.upsert({
    where: { email: 'choi@chon.ai' },
    update: { passwordHash: demoPasswordHash },
    create: { email: 'choi@chon.ai', phone: '+821044444444', phoneVerified: true, passwordHash: demoPasswordHash, name: '최서연' },
  });

  console.log(`✅ 사용자 5명 생성`);

  // ---------- PIN — 데모 디바이스 ----------
  const pinHash = await bcrypt.hash('789012', 12);
  await prisma.devicePin.upsert({
    where: { userId_deviceId: { userId: demo.id, deviceId: 'demo-device' } },
    update: { pinHash },
    create: { userId: demo.id, deviceId: 'demo-device', pinHash },
  });
  console.log(`✅ 데모 PIN 설정: 789012`);

  // ---------- 관계 ----------
  // demo ↔ friend1, friend2, friend3 (양방향 confirmed friend)
  const friends = [friend1, friend2, friend3];
  for (const f of friends) {
    await prisma.relation.upsert({
      where: { fromUserId_toUserId_kind: { fromUserId: demo.id, toUserId: f.id, kind: 'friend' } },
      update: { status: 'confirmed', confirmedAt: new Date() },
      create: { fromUserId: demo.id, toUserId: f.id, kind: 'friend', status: 'confirmed', confirmedAt: new Date() },
    });
    await prisma.relation.upsert({
      where: { fromUserId_toUserId_kind: { fromUserId: f.id, toUserId: demo.id, kind: 'friend' } },
      update: { status: 'confirmed', confirmedAt: new Date() },
      create: { fromUserId: f.id, toUserId: demo.id, kind: 'friend', status: 'confirmed', confirmedAt: new Date() },
    });
  }

  // friend1 ↔ fof (so fof becomes demo's 2-hop)
  await prisma.relation.upsert({
    where: { fromUserId_toUserId_kind: { fromUserId: friend1.id, toUserId: fof.id, kind: 'friend' } },
    update: { status: 'confirmed', confirmedAt: new Date() },
    create: { fromUserId: friend1.id, toUserId: fof.id, kind: 'friend', status: 'confirmed', confirmedAt: new Date() },
  });
  await prisma.relation.upsert({
    where: { fromUserId_toUserId_kind: { fromUserId: fof.id, toUserId: friend1.id, kind: 'friend' } },
    update: { status: 'confirmed', confirmedAt: new Date() },
    create: { fromUserId: fof.id, toUserId: friend1.id, kind: 'friend', status: 'confirmed', confirmedAt: new Date() },
  });

  // 가족 — friend1을 부친, friend2를 모친으로 데모 설정
  await prisma.relation.upsert({
    where: { fromUserId_toUserId_kind: { fromUserId: demo.id, toUserId: friend1.id, kind: 'family' } },
    update: {},
    create: {
      fromUserId: demo.id, toUserId: friend1.id, kind: 'family',
      subtype: 'parents', meta: JSON.stringify({ rel: '아버지' }),
      status: 'confirmed', confirmedAt: new Date(), birthOrder: 1,
    },
  });
  console.log(`✅ 관계 그래프 생성 (1-hop 3명, 2-hop 1명, 가계도 일부)`);

  // ---------- 포스트 ----------
  const posts = [
    { authorId: friend1.id, content: '오늘 한강에서 자전거 타고 왔어요 🚴' },
    { authorId: friend2.id, content: '새로 배운 라떼아트 ☕' },
    { authorId: friend3.id, content: '주말에 등산 같이 가실 분?' },
    { authorId: fof.id, content: '드디어 PASS 가입했어요! 안녕하세요 👋', audience: 'extended' },
  ];
  for (const p of posts) {
    await prisma.post.create({ data: p });
  }
  console.log(`✅ 포스트 ${posts.length}개`);

  // ---------- 대화방 + 메시지 ----------
  const pair = demo.id < friend1.id ? [demo.id, friend1.id] : [friend1.id, demo.id];
  const conv = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId: pair[0], userBId: pair[1] } },
    update: {},
    create: { userAId: pair[0], userBId: pair[1] },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv.id, senderId: friend1.id, text: '안녕! 잘 지내?' },
      { conversationId: conv.id, senderId: demo.id, text: '응 잘 지내고 있어 ㅎㅎ' },
      { conversationId: conv.id, senderId: friend1.id, text: '주말에 시간 돼?' },
    ],
  });
  const last = await prisma.message.findFirst({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'desc' },
  });
  if (last) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessage: last.text, lastAt: last.createdAt },
    });
  }
  console.log(`✅ 대화방 1개 + 메시지 3개`);

  console.log('\n🎉 시드 완료!');
  console.log('\n로그인 정보:');
  console.log('  이메일: demo@chon.ai');
  console.log('  전화번호: 010-1234-5678');
  console.log('  PIN (디바이스 demo-device): 789012');
  console.log('  OTP: 123456 (env OTP_DEMO_CODE)');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
