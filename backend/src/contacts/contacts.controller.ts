import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

class ContactEntry {
  @IsString() phone: string;
  @IsOptional() @IsString() displayName?: string;
}

class SyncContactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactEntry)
  contacts: ContactEntry[];
}

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Post('sync')
  sync(@CurrentUser() user: JwtPayload, @Body() dto: SyncContactsDto) {
    return this.contacts.sync(user.sub, dto.contacts);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.contacts.list(user.sub);
  }

  @Post(':hashedPhone/invite')
  invite(@CurrentUser() user: JwtPayload, @Param('hashedPhone') hashedPhone: string) {
    return this.contacts.markInvited(user.sub, hashedPhone);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.contacts.remove(user.sub, id);
  }
}
