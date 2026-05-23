import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('사용자 없음');
    return this.toPublic(u);
  }

  async updateProfile(id: string, body: { name?: string; avatar?: string }) {
    const u = await this.prisma.user.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        avatar: body.avatar ?? undefined,
      },
    });
    return this.toPublic(u);
  }

  async deleteAccount(id: string) {
    // 소프트 삭제 — status=deleted
    await this.prisma.user.update({
      where: { id },
      data: { status: 'deleted' },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  /// 이메일로 사용자 검색 (가입 여부 확인)
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  toPublic(u: any) {
    return {
      id: u.id, email: u.email, phone: u.phone, name: u.name, avatar: u.avatar,
      status: u.status, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
    };
  }
}
