import {
  Body, Controller, Get, Headers, HttpCode, Ip, Post, UseGuards, Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RequestOtpDto, VerifyOtpDto, SignupDto, LoginPasswordDto,
  SetupPinDto, LoginPinDto, RefreshDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // ---------- OTP ----------
  @Post('otp/request')
  @HttpCode(200)
  request(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto, ip);
  }

  @Post('otp/verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  // ---------- Signup ----------
  @Post('signup')
  signup(@Body() dto: SignupDto, @Ip() ip: string) {
    return this.auth.signup(dto, ip);
  }

  // ---------- Login ----------
  @Post('login/password')
  @HttpCode(200)
  loginByPassword(@Body() dto: LoginPasswordDto, @Ip() ip: string) {
    return this.auth.loginPassword(dto, ip);
  }

  @Post('login/pin')
  @HttpCode(200)
  loginByPin(@Body() dto: LoginPinDto) {
    return this.auth.loginByPin(dto);
  }

  // ---------- PIN setup (JWT 보호) ----------
  @UseGuards(JwtAuthGuard)
  @Post('pin/setup')
  @HttpCode(200)
  setupPin(@CurrentUser() user: JwtPayload, @Body() dto: SetupPinDto) {
    return this.auth.setupPin(user.sub, dto);
  }

  // ---------- Refresh ----------
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken, dto.deviceId);
  }

  // ---------- Logout ----------
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  logout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { deviceId?: string; all?: boolean },
  ) {
    return this.auth.logout(user.sub, body.deviceId, body.all);
  }

  // ---------- Me ----------
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return { ok: true, user };
  }
}
