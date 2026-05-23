import {
  Body, Controller, Delete, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/current-user.decorator';

class OpenWithDto {
  @IsString() userId: string;
}

class SendMessageDto {
  @IsString() @MaxLength(2000) text: string;
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get('conversations')
  list(@CurrentUser() user: JwtPayload) {
    return this.chat.listConversations(user.sub);
  }

  @Post('conversations/open')
  open(@CurrentUser() user: JwtPayload, @Body() dto: OpenWithDto) {
    return this.chat.getOrCreateConversation(user.sub, dto.userId);
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chat.getConversation(user.sub, id);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chat.listMessages(user.sub, id, { cursor, limit });
  }

  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(user.sub, id, dto.text);
  }

  @Post('conversations/:id/read')
  read(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.chat.markRead(user.sub, id);
  }

  @Delete('messages/:messageId')
  remove(@CurrentUser() user: JwtPayload, @Param('messageId') mid: string) {
    return this.chat.deleteMessage(user.sub, mid);
  }
}
