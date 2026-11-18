import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";

export type AuthUser = { id: string; email: string };
export type JwtPayload = { sub: string; email: string };

type StoredUser = AuthUser & { passwordHash: string };

/**
 * Demo credential store: replace with your user repository.
 * The seeded user comes from DEMO_USER_EMAIL / DEMO_USER_PASSWORD (see .env.example).
 */
@Injectable()
export class AuthService {
  private readonly users: StoredUser[];

  constructor(private readonly jwt: JwtService) {
    const email = process.env.DEMO_USER_EMAIL ?? "demo@example.com";
    const password = process.env.DEMO_USER_PASSWORD ?? "change-me";
    this.users = [{ id: "1", email, passwordHash: bcrypt.hashSync(password, 10) }];
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = this.users.find((candidate) => candidate.email === email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  async verify(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
