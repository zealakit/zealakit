# DevOps & Deployment

**Section Impact: LOW-MEDIUM**

### 10.1 Implement Graceful Shutdown

**Impact: MEDIUM-HIGH** — Proper shutdown handling ensures zero-downtime deployments

Handle SIGTERM and SIGINT signals to gracefully shutdown your NestJS application. Stop accepting new requests, wait for in-flight requests to complete, close database connections, and clean up resources. This prevents data loss and connection errors during deployments.

**Incorrect (ignoring shutdown signals):**

```typescript
// Ignore shutdown signals
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  // App crashes immediately on SIGTERM
  // In-flight requests fail
  // Database connections are abruptly closed
}

// Long-running tasks without cancellation
@Injectable()
export class ProcessingService {
  async processLargeFile(file: File): Promise<void> {
    // No way to interrupt this during shutdown
    for (let i = 0; i < file.chunks.length; i++) {
      await this.processChunk(file.chunks[i]);
      // May run for minutes, blocking shutdown
    }
  }
}
```

**Correct (enable shutdown hooks and handle cleanup):**

```typescript
// Enable shutdown hooks in main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Optional: Add timeout for forced shutdown
  const server = await app.listen(3000);
  server.setTimeout(30000); // 30 second timeout

  // Handle graceful shutdown
  const signals = ["SIGTERM", "SIGINT"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        console.log("HTTP server closed");
        await app.close();
        process.exit(0);
      });

      // Force exit after timeout
      setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    });
  });
}

// Lifecycle hooks for cleanup
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly connections: Connection[] = [];

  async onApplicationShutdown(signal?: string): Promise<void> {
    console.log(`Database service shutting down on ${signal}`);

    // Close all connections gracefully
    await Promise.all(this.connections.map((conn) => conn.close()));

    console.log("All database connections closed");
  }
}

// Queue processor with graceful shutdown
@Injectable()
export class QueueService implements OnApplicationShutdown, OnModuleDestroy {
  private isShuttingDown = false;

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  async onApplicationShutdown(): Promise<void> {
    // Wait for current jobs to complete
    await this.queue.close();
  }

  async processJob(job: Job): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error("Service is shutting down");
    }
    await this.doWork(job);
  }
}

// WebSocket gateway cleanup
@WebSocketGateway()
export class EventsGateway implements OnApplicationShutdown {
  @WebSocketServer()
  server: Server;

  async onApplicationShutdown(): Promise<void> {
    // Notify all connected clients
    this.server.emit("shutdown", { message: "Server is shutting down" });

    // Close all connections
    this.server.disconnectSockets();
  }
}

// Health check integration
@Injectable()
export class ShutdownService {
  private isShuttingDown = false;

  startShutdown(): void {
    this.isShuttingDown = true;
  }

  isShutdown(): boolean {
    return this.isShuttingDown;
  }
}

@Controller("health")
export class HealthController {
  constructor(private shutdownService: ShutdownService) {}

  @Get("ready")
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    // Return 503 during shutdown - k8s stops sending traffic
    if (this.shutdownService.isShutdown()) {
      throw new ServiceUnavailableException("Shutting down");
    }

    return this.health.check([() => this.db.pingCheck("database")]);
  }
}

// Integrate with shutdown
@Injectable()
export class AppShutdownService implements OnApplicationShutdown {
  constructor(private shutdownService: ShutdownService) {}

  async onApplicationShutdown(): Promise<void> {
    // Mark as unhealthy first
    this.shutdownService.startShutdown();

    // Wait for k8s to update endpoints
    await this.sleep(5000);

    // Then proceed with cleanup
  }
}

// Request tracking for in-flight requests
@Injectable()
export class RequestTracker implements NestMiddleware, OnApplicationShutdown {
  private activeRequests = 0;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private resolveShutdown: (() => void) | null = null;

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.isShuttingDown) {
      res.status(503).send("Service Unavailable");
      return;
    }

    this.activeRequests++;

    res.on("finish", () => {
      this.activeRequests--;
      if (
        this.isShuttingDown &&
        this.activeRequests === 0 &&
        this.resolveShutdown
      ) {
        this.resolveShutdown();
      }
    });

    next();
  }

  async onApplicationShutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.activeRequests > 0) {
      console.log(`Waiting for ${this.activeRequests} requests to complete`);
      this.shutdownPromise = new Promise((resolve) => {
        this.resolveShutdown = resolve;
      });

      // Wait with timeout
      await Promise.race([
        this.shutdownPromise,
        new Promise((resolve) => setTimeout(resolve, 30000)),
      ]);
    }

    console.log("All requests completed");
  }
}
```

Reference: [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)

---

### 10.2 Use ConfigModule for Environment Configuration

**Impact: LOW-MEDIUM** — Proper configuration prevents deployment failures

Use `@nestjs/config` for environment-based configuration. Validate configuration at startup to fail fast on misconfigurations. Use namespaced configuration for organization and type safety.

**Incorrect (accessing process.env directly):**

```typescript
// Access process.env directly
@Injectable()
export class DatabaseService {
  constructor() {
    // No validation, can fail at runtime
    this.connection = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT), // NaN if missing
      password: process.env.DB_PASSWORD, // undefined if missing
    });
  }
}

// Scattered env access
@Injectable()
export class EmailService {
  sendEmail() {
    // Different services access env differently
    const apiKey = process.env.SENDGRID_API_KEY || "default";
    // Typos go unnoticed: process.env.SENDGRID_API_KY
  }
}
```

**Correct (use @nestjs/config with validation):**

```typescript
// Setup validated configuration
import { ConfigModule, ConfigService, registerAs } from "@nestjs/config";
import * as Joi from "joi";

// config/database.config.ts
export const databaseConfig = registerAs("database", () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}));

// config/app.config.ts
export const appConfig = registerAs("app", () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: process.env.NODE_ENV || "development",
  apiPrefix: process.env.API_PREFIX || "api",
}));

// config/validation.schema.ts
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  REDIS_URL: Joi.string().uri().required(),
});

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Available everywhere without importing
      load: [databaseConfig, appConfig],
      validationSchema,
      validationOptions: {
        abortEarly: true, // Stop on first error
        allowUnknown: true, // Allow other env vars
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("database.host"),
        port: config.get("database.port"),
        username: config.get("database.username"),
        password: config.get("database.password"),
        database: config.get("database.database"),
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class AppModule {}

// Type-safe configuration access
export interface AppConfig {
  port: number;
  environment: "development" | "production" | "test";
  apiPrefix: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// Type-safe access
@Injectable()
export class AppService {
  constructor(private config: ConfigService) {}

  getPort(): number {
    // Type-safe with generic
    return this.config.get<number>("app.port");
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.config.get<DatabaseConfig>("database");
  }
}

// Inject namespaced config directly
@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private dbConfig: ConfigType<typeof databaseConfig>,
  ) {
    // Full type inference!
    const host = this.dbConfig.host; // string
    const port = this.dbConfig.port; // number
  }
}

// Environment files support
ConfigModule.forRoot({
  envFilePath: [
    `.env.${process.env.NODE_ENV}.local`,
    `.env.${process.env.NODE_ENV}`,
    ".env.local",
    ".env",
  ],
});

// .env.development
// DB_HOST=localhost
// DB_PORT=5432

// .env.production
// DB_HOST=prod-db.example.com
// DB_PORT=5432
```

Reference: [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)

---

### 10.3 Use Structured Logging

**Impact: MEDIUM-HIGH** — Structured logging enables effective debugging and monitoring

Use NestJS Logger with structured JSON output in production. Include contextual information (request ID, user ID, operation) to trace requests across services. Avoid console.log and implement proper log levels.

**Incorrect (using console.log in production):**

```typescript
// Use console.log in production
@Injectable()
export class UsersService {
  async createUser(dto: CreateUserDto): Promise<User> {
    console.log("Creating user:", dto);
    // Not structured, no levels, lost in production logs

    try {
      const user = await this.repo.save(dto);
      console.log("User created:", user.id);
      return user;
    } catch (error) {
      console.log("Error:", error); // Using log for errors
      throw error;
    }
  }
}

// Log sensitive data
console.log("Login attempt:", { email, password }); // SECURITY RISK!

// Inconsistent log format
logger.log("User " + userId + " created at " + new Date());
// Hard to parse, no structure
```

**Correct (use structured logging with context):**

```typescript
// Configure logger in main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === "production"
        ? ["error", "warn", "log"]
        : ["error", "warn", "log", "debug", "verbose"],
  });
}

// Use NestJS Logger with context
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.log("Creating user", { email: dto.email });

    try {
      const user = await this.repo.save(dto);
      this.logger.log("User created", { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error("Failed to create user", error.stack, {
        email: dto.email,
      });
      throw error;
    }
  }
}

// Custom logger for JSON output
@Injectable()
export class JsonLogger implements LoggerService {
  log(message: string, context?: object): void {
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        ...context,
      }),
    );
  }

  error(message: string, trace?: string, context?: object): void {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        trace,
        ...context,
      }),
    );
  }

  warn(message: string, context?: object): void {
    console.warn(
      JSON.stringify({
        level: "warn",
        timestamp: new Date().toISOString(),
        message,
        ...context,
      }),
    );
  }

  debug(message: string, context?: object): void {
    console.debug(
      JSON.stringify({
        level: "debug",
        timestamp: new Date().toISOString(),
        message,
        ...context,
      }),
    );
  }
}

// Request context logging with ClsModule
import { ClsModule, ClsService } from "nestjs-cls";

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
      },
    }),
  ],
})
export class AppModule {}

// Middleware to set request context
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers["x-request-id"] || randomUUID();
    this.cls.set("requestId", requestId);
    this.cls.set("userId", req.user?.id);

    res.setHeader("x-request-id", requestId);
    next();
  }
}

// Logger that includes request context
@Injectable()
export class ContextLogger {
  constructor(private cls: ClsService) {}

  log(message: string, data?: object): void {
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        requestId: this.cls.get("requestId"),
        userId: this.cls.get("userId"),
        message,
        ...data,
      }),
    );
  }

  error(message: string, error: Error, data?: object): void {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        requestId: this.cls.get("requestId"),
        userId: this.cls.get("userId"),
        message,
        error: error.message,
        stack: error.stack,
        ...data,
      }),
    );
  }
}

// Pino integration for high-performance logging
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty" }
            : undefined,
        redact: ["req.headers.authorization", "req.body.password"],
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            query: req.query,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
})
export class AppModule {}

// Usage with Pino
@Injectable()
export class UsersService {
  constructor(private logger: PinoLogger) {
    this.logger.setContext(UsersService.name);
  }

  async findOne(id: string): Promise<User> {
    this.logger.info({ userId: id }, "Finding user");
    // Pino uses first arg for data, second for message
  }
}
```

Reference: [NestJS Logger](https://docs.nestjs.com/techniques/logger)

---
