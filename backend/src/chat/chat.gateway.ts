import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface AuthedSocket extends Socket {
  userId?: string;
  email?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chat: ChatService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  // ============================================================
  // 연결 시: JWT 검증 → userId 주입 + user 룸 join
  // ============================================================
  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string) ||
        this.extractFromHeader(client.handshake.headers?.authorization);
      if (!token) throw new Error('토큰 없음');

      const payload = await this.jwt.verifyAsync(token, {
        secret: this.cfg.get<string>('JWT_ACCESS_SECRET'),
      });
      client.userId = payload.sub;
      client.email = payload.email;

      // 본인 룸 자동 join — 어디서든 수신 가능
      client.join(`user:${client.userId}`);
      this.logger.log(`🔌 연결: ${client.email} (${client.id})`);
      client.emit('connected', { ok: true, userId: client.userId });
    } catch (e) {
      this.logger.warn(`🔒 인증 실패: ${(e as Error).message}`);
      client.emit('error', { message: '인증 실패' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (client.email) this.logger.log(`👋 연결 해제: ${client.email}`);
  }

  // ============================================================
  // 대화방 입장 (해당 conversation 룸 join)
  // ============================================================
  @SubscribeMessage('conversation:join')
  async joinConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) throw new WsException('미인증');
    // 권한 확인
    await this.chat.getConversation(client.userId, data.conversationId);
    client.join(`conv:${data.conversationId}`);
    return { ok: true, joined: data.conversationId };
  }

  @SubscribeMessage('conversation:leave')
  leaveConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conv:${data.conversationId}`);
    return { ok: true, left: data.conversationId };
  }

  // ============================================================
  // 메시지 전송 — DB 저장 + 대화방 + 상대 사용자 룸에 emit
  // ============================================================
  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; text: string },
  ) {
    if (!client.userId) throw new WsException('미인증');
    const msg = await this.chat.sendMessage(client.userId, data.conversationId, data.text);

    // 대화방 룸에 broadcast (본인 포함 — UI에서 echo 처리)
    this.server.to(`conv:${data.conversationId}`).emit('message:new', {
      conversationId: data.conversationId,
      message: msg,
    });

    // 상대방의 user 룸에도 (대화방을 안 켜둔 경우 알림용)
    const conv = await this.chat.getConversation(client.userId, data.conversationId);
    if (conv.other?.id) {
      this.server.to(`user:${conv.other.id}`).emit('message:notify', {
        conversationId: data.conversationId,
        from: { id: client.userId, email: client.email },
        preview: msg.text.slice(0, 80),
      });
    }
    return { ok: true, messageId: msg.id };
  }

  // ============================================================
  // 읽음 — 상대에게 알림
  // ============================================================
  @SubscribeMessage('message:read')
  async markRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) throw new WsException('미인증');
    const result = await this.chat.markRead(client.userId, data.conversationId);
    // 상대에게 "내가 다 읽었음"
    this.server.to(`conv:${data.conversationId}`).emit('message:read', {
      conversationId: data.conversationId,
      readerId: client.userId,
      count: result.marked,
    });
    return result;
  }

  // ============================================================
  // 타이핑 — 트랜션트 (DB 저장 안 함)
  // ============================================================
  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!client.userId) return;
    client.broadcast.to(`conv:${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId: client.userId,
      isTyping: !!data.isTyping,
    });
  }

  // ============================================================
  // 헬퍼
  // ============================================================
  private extractFromHeader(authHeader?: string | string[]): string | null {
    if (!authHeader) return null;
    const h = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (h.startsWith('Bearer ')) return h.substring(7);
    return null;
  }
}
