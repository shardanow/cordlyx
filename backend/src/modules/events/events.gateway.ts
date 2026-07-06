import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WsResponse } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
@WebSocketGateway({ namespace: '/events', cors: true })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server = null as unknown as Server;

  afterInit(server: Server) {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { projectId: string; userId: string }): WsResponse {
    client.join(payload.projectId);
    if (payload.userId) client.join(`user:${payload.userId}`);
    this.logger.log(`User ${payload.userId} joined project ${payload.projectId}`);
    return { event: 'joined', data: payload };
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, payload: { projectId: string }): WsResponse {
    client.leave(payload.projectId);
    this.logger.log(`Client ${client.id} left project ${payload.projectId}`);
    return { event: 'left', data: payload };
  }

  handleJoinProject(client: Socket, projectId: string): void {
    client.join(projectId);
    this.logger.log(`Client joined project ${projectId}`);
  }

  handleLeaveProject(client: Socket, projectId: string): void {
    client.leave(projectId);
    this.logger.log(`Client left project ${projectId}`);
  }

  @OnEvent('item.created')
  handleItemCreated(payload: any): void {
    this.emitEvent('item:created', payload);
  }

  @OnEvent('item.assigned')
  handleItemAssigned(payload: any): void {
    this.emitEvent('item:assigned', payload);
  }

  @OnEvent('item.updated')
  handleItemUpdated(payload: any): void {
    this.emitEvent('item:updated', payload);
  }

  @OnEvent('item.deleted')
  handleItemDeleted(payload: any): void {
    this.emitEvent('item:deleted', payload);
  }

  @OnEvent('comment.created')
  handleCommentCreated(payload: any): void {
    this.emitEvent('comment:created', payload);
  }

  @OnEvent('comment.updated')
  handleCommentUpdated(payload: any): void {
    this.emitEvent('comment:updated', payload);
  }

  @OnEvent('comment.deleted')
  handleCommentDeleted(payload: any): void {
    this.emitEvent('comment:deleted', payload);
  }

  emitEvent(event: string, data: any): void {
    this.server.to(data.projectId).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
