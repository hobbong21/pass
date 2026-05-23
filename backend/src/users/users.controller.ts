import {
  Body, Controller, Delete, Get, Patch, Param, UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() avatar?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: JwtPayload) {
    return this.users.deleteAccount(user.sub);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
