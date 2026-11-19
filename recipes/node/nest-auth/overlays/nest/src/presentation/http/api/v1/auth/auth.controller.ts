import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService, type JwtPayload } from "@/application/auth/auth.service.js";
import { JwtAuthGuard } from "@/presentation/http/guards/jwt-auth.guard.js";
import { LoginRequestDto } from "./dto/login.request.dto.js";

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  login(@Body() body: LoginRequestDto): Promise<{ accessToken: string }> {
    return this.auth.login(body.email, body.password);
  }

  /** Example protected route. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: { user: JwtPayload }): { id: string; email: string } {
    return { id: request.user.sub, email: request.user.email };
  }
}
