import { Injectable, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service.js';

/**
 * Accepts either:
 *   - Authorization: Bearer <jwt>
 *   - X-API-Key: clx_<key>
 */
@Injectable()
export class ApiKeyOrJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeysService: ApiKeysService) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (apiKey) {
      const user = await this.apiKeysService.validateKey(apiKey);
      if (!user) throw new UnauthorizedException('Invalid or expired API key');
      request.user = user;
      // If key is scoped to a project, enforce it
      if (user.projectId) request.apiKeyProjectId = user.projectId;
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  override handleRequest<TUser = any>(err: Error | null, user: TUser): TUser {
    if (err || !user) throw err ?? new UnauthorizedException('Invalid or expired token');
    return user;
  }
}
