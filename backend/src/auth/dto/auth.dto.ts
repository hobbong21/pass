import { IsEmail, IsString, IsOptional, Length, Matches, IsIn } from 'class-validator';

export class RequestOtpDto {
  @IsIn(['email', 'sms'])
  channel: 'email' | 'sms';

  @IsString()
  target: string; // 이메일 또는 전화번호

  @IsOptional()
  @IsIn(['login', 'register', 'reset_pin'])
  purpose?: 'login' | 'register' | 'reset_pin' = 'login';
}

export class VerifyOtpDto {
  @IsIn(['email', 'sms'])
  channel: 'email' | 'sms';

  @IsString()
  target: string;

  @IsString()
  @Length(6, 6, { message: '인증 코드는 6자리입니다' })
  @Matches(/^\d{6}$/, { message: '6자리 숫자만 가능' })
  code: string;

  @IsOptional()
  @IsIn(['login', 'register', 'reset_pin'])
  purpose?: 'login' | 'register' | 'reset_pin' = 'login';
}

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일이 아닙니다' })
  email: string;

  @IsString()
  @Matches(/^[0-9+\-\s]{9,20}$/, { message: '올바른 전화번호가 아닙니다' })
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @Length(8, 64, { message: '비밀번호는 8~64자입니다' })
  password: string;

  @IsString()
  @Length(6, 6, { message: 'OTP는 6자리입니다' })
  @Matches(/^\d{6}$/)
  otp: string;
}

export class LoginPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 64)
  password: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class SetupPinDto {
  @IsString()
  deviceId: string;

  @IsString()
  @Length(6, 6, { message: 'PIN은 6자리입니다' })
  @Matches(/^\d{6}$/)
  pin: string;
}

export class LoginPinDto {
  @IsString()
  deviceId: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
