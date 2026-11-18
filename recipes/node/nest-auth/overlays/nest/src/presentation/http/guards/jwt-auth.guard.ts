import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService, type JwtPayload } from "@/application/auth/auth.service.js";

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  user?: JwtPayload;
};

/** Requires `Authorization: Bearer <token>`; exposes the payload as `request.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const [scheme, token] = value?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing bearer token");
    }
    request.user = await this.auth.verify(token);
    return true;
  }
}
