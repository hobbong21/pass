import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { sha256, normalizePhone, generateOtpCode } from '../common/hash.util';
import {
  RequestOtpDto,
  VerifyOtpDto,
  SignupDto,
  LoginEmailOtpDto,
  SetupPinDto,
  LoginPinDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  // ============================================================
  // OTP 발급
  // ============================================================
  async requestOtp(dto: RequestOtpDto, ip?: string) {
    const target = dto.channel === 'sms' ? normalizePhone(dto.target) : dto.target.toLowerCase();
    const purpose = dto.purpose || 'login';

    // login/reset_pin은 가입된 사용자만 허용
    if (purpose !== 'register') {
      const user = await this.findUserByTarget(dto.channel, target);
      if (!user) throw new NotFoundException('등록되지 않은 사용자입니다');
    }

    // 짧은 간격 재발급 제한 — 같은 target에 30초 내 미소비 코드가 있으면 거절
    // (test 환경에서는 우회)
    if (process.env.NODE_ENV !== 'test') {
      const recent = await this.prisma.authCode.findFirst({
        where: {
          target,
          purpose,
          consumedAt: null,
          createdAt: { gt: new Date(Date.now() - 30_000) },
        },
      });
      if (recent) {
        throw new BadRequestException('잠시 후 다시 요청해 주세요');
      }
    }

    const code = generateOtpCode(this.cfg.get<string>('OTP_DEMO_CODE'));
    const ttl = Number(this.cfg.get('OTP_TTL_SECONDS') ?? 180);

    await this.prisma.authCode.create({
      data: {
        channel: dto.channel,
        target,
        codeHash: sha256(code),
        purpose,
        maxAttempts: Number(this.cfg.get('OTP_MAX_ATTEMPTS') ?? 5),
        expiresAt: new Date(Date.now() + ttl * 1000),
        ipAddress: ip,
      },
    });

    this.logger.log(`📨 OTP 발급 [${dto.channel}] ${target} purpose=${purpose}`);
    // 데모: 응답에 코드 포함. 프로덕션에서는 SMS/메일 발송 후 코드 미반환.
    const isDev = process.env.NODE_ENV !== 'production';
    return {
      ok: true,
      expiresInSec: ttl,
      ...(isDev ? { demoCode: code } : {}),
    };
  }

  // ============================================================
  // OTP 검증 (consumed 처리 + attempts 카운트)
  //   성공 시 그 자체로 로그인은 아님 — 후속 signup/login 단계에서 다시 검증
  //   하지만 attempts/expires 트래킹은 여기서 함
  // ============================================================
  async verifyOtp(dto: VerifyOtpDto): Promise<{ ok: true; codeId: string }> {
    const target = dto.channel === 'sms' ? normalizePhone(dto.target) : dto.target.toLowerCase();
    const purpose = dto.purpose || 'login';

    const code = await this.prisma.authCode.findFirst({
      where: {
        target, purpose, consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!code) throw new BadRequestException('인증 코드가 만료되었거나 없습니다');

    if (code.attempts >= code.maxAttempts) {
      throw new ForbiddenException('인증 시도 횟수를 초과했습니다');
    }

    if (sha256(dto.code) !== code.codeHash) {
      await this.prisma.authCode.update({
        where: { id: code.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('인증 코드가 일치하지 않습니다');
    }

    await this.prisma.authCode.update({
      where: { id: code.id },
      data: { consumedAt: new Date() },
    });
    return { ok: true, codeId: code.id };
  }

  // ============================================================
  // 가입 — 이메일 + 전화번호 + 휴대폰 OTP
  // ============================================================
  async signup(dto: SignupDto, ip?: string) {
    const email = dto.email.toLowerCase();
    const phone = normalizePhone(dto.phone);

    // 중복 검사
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === email ? '이미 가입된 이메일입니다' : '이미 가입된 휴대폰입니다',
      );
    }

    // 휴대폰 OTP 검증 (register 목적)
    await this.verifyOtp({
      channel: 'sms', target: dto.phone, code: dto.otp, purpose: 'register',
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        phoneVerified: true,
        name: dto.name ?? email.split('@')[0],
      },
    });

    this.logger.log(`✅ 신규 가입: ${email} / ${phone}`);
    return { ok: true, userId: user.id, email: user.email };
  }

  // ============================================================
  // 이메일 OTP 로그인 (1FA)
  // ============================================================
  async loginEmailOtp(dto: LoginEmailOtpDto, ip?: string) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('등록되지 않은 이메일');
    if (user.status !== 'active') throw new ForbiddenException('계정 비활성');

    await this.verifyOtp({ channel: 'email', target: email, code: dto.code, purpose: 'login' });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.email, dto.deviceId);
    return { ok: true, user: this.toPublicUser(user), ...tokens };
  }

  // ============================================================
  // PIN 설정 (2FA — 디바이스 결속)
  //   로그인된 사용자만 호출 가능 (JwtAuthGuard 보호)
  // ============================================================
  async setupPin(userId: string, dto: SetupPinDto) {
    if (this.isTrivialPin(dto.pin)) {
      throw new BadRequestException('추측 가능한 PIN은 사용할 수 없습니다');
    }
    const rounds = Number(this.cfg.get('PIN_BCRYPT_ROUNDS') ?? 12);
    const pinHash = await bcrypt.hash(dto.pin, rounds);

    await this.prisma.devicePin.upsert({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
      update: { pinHash, failedTries: 0, lockedUntil: null },
      create: { userId, deviceId: dto.deviceId, pinHash },
    });
    return { ok: true };
  }

  // ============================================================
  // PIN 로그인 (2FA만으로) — 디바이스 등록된 경우
  // ============================================================
  async loginByPin(dto: LoginPinDto) {
    const devicePin = await this.prisma.devicePin.findFirst({
      where: { deviceId: dto.deviceId },
      include: { user: true },
    });
    if (!devicePin) throw new NotFoundException('이 디바이스는 등록되지 않았습니다');
    if (devicePin.user.status !== 'active') throw new ForbiddenException('계정 비활성');

    if (devicePin.lockedUntil && devicePin.lockedUntil > new Date()) {
      throw new ForbiddenException('PIN 잠금 상태 — 잠시 후 다시 시도해 주세요');
    }

    const match = await bcrypt.compare(dto.pin, devicePin.pinHash);
    if (!match) {
      const newTries = devicePin.failedTries + 1;
      const data: any = { failedTries: newTries };
      // 5회 실패 시 10분 잠금
      if (newTries >= 5) {
        data.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
        data.failedTries = 0;
      }
      await this.prisma.devicePin.update({ where: { id: devicePin.id }, data });
      throw new UnauthorizedException(
        newTries >= 5 ? 'PIN 5회 실패 — 10분 잠금' : 'PIN이 일치하지 않습니다',
      );
    }

    // 성공 — 카운터 리셋
    await this.prisma.devicePin.update({
      where: { id: devicePin.id },
      data: { failedTries: 0 },
    });
    await this.prisma.user.update({
      where: { id: devicePin.userId },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(devicePin.userId, devicePin.user.email, dto.deviceId);
    return { ok: true, user: this.toPublicUser(devicePin.user), ...tokens };
  }

  // ============================================================
  // Refresh Token 회전
  // ============================================================
  async refresh(refreshToken: string, deviceId?: string) {
    const tokenHash = sha256(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing || existing.revokedAt) {
      throw new UnauthorizedException('유효하지 않은 refresh 토큰');
    }
    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh 토큰 만료');
    }
    if (existing.user.status !== 'active') {
      throw new ForbiddenException('계정 비활성');
    }

    // 디바이스 결속 검증
    if (deviceId && existing.deviceId && existing.deviceId !== deviceId) {
      // 디바이스 불일치 — 모든 토큰 폐기 (도난 가능성)
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('디바이스 불일치 — 세션 전체 폐기');
    }

    // 회전 — 기존 토큰 폐기 + 새 토큰 발급
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    const tokens = await this.issueTokens(existing.userId, existing.user.email, existing.deviceId ?? undefined);
    return { ok: true, ...tokens };
  }

  // ============================================================
  // 로그아웃 — 단일 디바이스 또는 전체
  // ============================================================
  async logout(userId: string, deviceId?: string, all: boolean = false) {
    if (all) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (deviceId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      // deviceId 없으면 전체 폐기와 동일
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  // ============================================================
  // 내부 헬퍼
  // ============================================================
  private async issueTokens(userId: string, email: string, deviceId?: string) {
    const accessSecret = this.cfg.get<string>('JWT_ACCESS_SECRET')!;
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET')!;
    const accessExp = this.cfg.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    const refreshExp = this.cfg.get<string>('JWT_REFRESH_EXPIRES') ?? '14d';

    // jti — 매번 다른 토큰 보장 (같은 초에 회전해도 hash 충돌 없음)
    const accessJti = `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const refreshJti = `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, deviceId, jti: accessJti },
      { secret: accessSecret, expiresIn: accessExp },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, deviceId, jti: refreshJti },
      { secret: refreshSecret, expiresIn: refreshExp },
    );

    // refresh 저장 (해시)
    const exp = this.parseDurationMs(refreshExp);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        deviceId,
        expiresAt: new Date(Date.now() + exp),
      },
    });

    return { accessToken, refreshToken, expiresIn: this.parseDurationMs(accessExp) / 1000 };
  }

  private parseDurationMs(s: string): number {
    const m = /^(\d+)(s|m|h|d)$/.exec(s);
    if (!m) return 15 * 60 * 1000;
    const n = Number(m[1]);
    const unit = m[2];
    return n * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as any)[unit];
  }

  private async findUserByTarget(channel: 'email' | 'sms', target: string) {
    if (channel === 'email') return this.prisma.user.findUnique({ where: { email: target } });
    return this.prisma.user.findUnique({ where: { phone: target } });
  }

  private isTrivialPin(pin: string): boolean {
    if (/^(.)\1{5}$/.test(pin)) return true; // 111111
    if (pin === '123456' || pin === '654321') return true;
    if (pin === '000000') return true;
    return false;
  }

  private toPublicUser(u: any) {
    return {
      id: u.id, email: u.email, phone: u.phone, name: u.name, avatar: u.avatar,
      createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
    };
  }
}
