import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "@/application/auth/auth.service.js";
import { AuthController } from "@/presentation/http/api/v1/auth/auth.controller.js";
import { JwtAuthGuard } from "@/presentation/http/guards/jwt-auth.guard.js";

@Module({
  imports: [
    JwtModule.register({
      // Set JWT_SECRET in production; the fallback only exists for local development.
      secret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
      signOptions: { expiresIn: "1h" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
