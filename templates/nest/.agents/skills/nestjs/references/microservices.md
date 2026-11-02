# Microservices

**Section Impact: MEDIUM**

### 9.1 Implement Health Checks for Microservices

**Impact: MEDIUM-HIGH** — Health checks enable orchestrators to manage service lifecycle

Implement liveness and readiness probes using `@nestjs/terminus`. Liveness checks determine if the service should be restarted. Readiness checks determine if the service can accept traffic. Proper health checks enable Kubernetes and load balancers to route traffic correctly.

**Incorrect (simple ping that doesn"t check dependencies):**

```typescript
// Simple ping that doesn"t check dependencies
@Controller("health")
export class HealthController {
  @Get()
  check(): string {
    return "OK"; // Service might be unhealthy but returns OK
  }
}

// Health check that blocks on slow dependencies
@Controller("health")
export class HealthController {
  @Get()
  async check(): Promise<string> {
    // If database is slow, health check times out
    await this.userRepo.findOne({ where: { id: "1" } });
    await this.redis.ping();
    await this.externalApi.healthCheck();
    return "OK";
  }
}
```

**Correct (use @nestjs/terminus for comprehensive health checks):**

```typescript
// Use @nestjs/terminus for comprehensive health checks
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  HealthCheck,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  // Liveness probe - is the service alive?
  @Get("live")
  @HealthCheck()
  liveness() {
    return this.health.check([
      // Basic checks only
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024), // 200MB
    ]);
  }

  // Readiness probe - can the service handle traffic?
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () =>
        this.http.pingCheck("redis", "http://redis:6379", { timeout: 1000 }),
      () =>
        this.disk.checkStorage("disk", { path: "/", thresholdPercent: 0.9 }),
    ]);
  }

  // Deep health check for debugging
  @Get("deep")
  @HealthCheck()
  deepCheck() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024),
      () => this.memory.checkRSS("memory_rss", 300 * 1024 * 1024),
      () =>
        this.disk.checkStorage("disk", { path: "/", thresholdPercent: 0.9 }),
      () =>
        this.http.pingCheck("external-api", "https://api.example.com/health"),
    ]);
  }
}

// Custom indicator for business-specific health
@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(private queueService: QueueService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const queueStats = await this.queueService.getStats();

    const isHealthy = queueStats.failedCount < 100;
    const result = this.getStatus(key, isHealthy, {
      waiting: queueStats.waitingCount,
      active: queueStats.activeCount,
      failed: queueStats.failedCount,
    });

    if (!isHealthy) {
      throw new HealthCheckError("Queue unhealthy", result);
    }

    return result;
  }
}

// Redis health indicator
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@InjectRedis() private redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      return this.getStatus(key, pong === "PONG");
    } catch (error) {
      throw new HealthCheckError("Redis check failed", this.getStatus(key, false));
    }
  }
}

// Use custom indicators
@Get("ready")
@HealthCheck()
readiness() {
  return this.health.check([
    () => this.db.pingCheck("database"),
    () => this.redis.isHealthy("redis"),
    () => this.queue.isHealthy("job-queue"),
  ]);
}

// Graceful shutdown handling
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private isShuttingDown = false;

  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  async onApplicationShutdown(signal: string): Promise<void> {
    this.isShuttingDown = true;
    console.log(`Shutting down on ${signal}`);

    // Wait for in-flight requests
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

// Health check respects shutdown state
@Get("ready")
@HealthCheck()
readiness() {
  if (this.shutdownService.isShutdown()) {
    throw new ServiceUnavailableException("Shutting down");
  }

  return this.health.check([
    () => this.db.pingCheck("database"),
  ]);
}
```

### Kubernetes Configuration

```yaml
# Kubernetes deployment with probes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  template:
    spec:
      containers:
        - name: api
          image: api-service:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 30
```

Reference: [NestJS Terminus](https://docs.nestjs.com/recipes/terminus)

---

### 9.2 Use Message and Event Patterns Correctly

**Impact: MEDIUM** — Proper patterns ensure reliable microservice communication

NestJS microservices support two communication patterns: request-response (MessagePattern) and event-based (EventPattern). Use MessagePattern when you need a response, and EventPattern for fire-and-forget notifications. Understanding the difference prevents communication bugs.

**Incorrect (using wrong pattern for use case):**

```typescript
// Use @MessagePattern for fire-and-forget
@Controller()
export class NotificationsController {
  @MessagePattern("user.created")
  async handleUserCreated(data: UserCreatedEvent) {
    // This WAITS for response, blocking the sender
    await this.emailService.sendWelcome(data.email);
    // If email fails, sender gets an error (coupling!)
  }
}

// Use @EventPattern expecting a response
@Controller()
export class OrdersController {
  @EventPattern("inventory.check")
  async checkInventory(data: CheckInventoryDto) {
    const available = await this.inventory.check(data);
    return available; // This return value is IGNORED with @EventPattern!
  }
}

// Tight coupling in client
@Injectable()
export class UsersService {
  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.repo.save(dto);

    // Blocks until notification service responds
    await this.client.send("user.created", user).toPromise();
    // If notification service is down, user creation fails!

    return user;
  }
}
```

**Correct (use MessagePattern for request-response, EventPattern for fire-and-forget):**

```typescript
// MessagePattern: Request-Response (when you NEED a response)
@Controller()
export class InventoryController {
  @MessagePattern({ cmd: "check_inventory" })
  async checkInventory(data: CheckInventoryDto): Promise<InventoryResult> {
    const result = await this.inventoryService.check(data.productId, data.quantity);
    return result; // Response sent back to caller
  }
}

// Client expects response
@Injectable()
export class OrdersService {
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // Check inventory - we NEED this response to proceed
    const inventory = await firstValueFrom(
      this.inventoryClient.send<InventoryResult>(
        { cmd: "check_inventory" },
        { productId: dto.productId, quantity: dto.quantity },
      ),
    );

    if (!inventory.available) {
      throw new BadRequestException("Insufficient inventory");
    }

    return this.repo.save(dto);
  }
}

// EventPattern: Fire-and-Forget (for notifications, side effects)
@Controller()
export class NotificationsController {
  @EventPattern("user.created")
  async handleUserCreated(data: UserCreatedEvent): Promise<void> {
    // No return value needed - just process the event
    await this.emailService.sendWelcome(data.email);
    await this.analyticsService.track("user_signup", data);
    // If this fails, it doesn"t affect the sender
  }
}

// Client emits event without waiting
@Injectable()
export class UsersService {
  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.repo.save(dto);

    // Fire and forget - doesn"t block, doesn"t wait
    this.eventClient.emit("user.created", {
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
    });

    return user; // User creation succeeds regardless of event handling
  }
}

// Hybrid pattern for critical events
@Injectable()
export class OrdersService {
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.repo.save(dto);

    // Critical: inventory reservation (use MessagePattern)
    const reserved = await firstValueFrom(
      this.inventoryClient.send({ cmd: "reserve_inventory" }, {
        orderId: order.id,
        items: dto.items,
      }),
    );

    if (!reserved.success) {
      await this.repo.delete(order.id);
      throw new BadRequestException("Could not reserve inventory");
    }

    // Non-critical: notifications (use EventPattern)
    this.eventClient.emit("order.created", {
      orderId: order.id,
      userId: dto.userId,
      total: dto.total,
    });

    return order;
  }
}

// Error handling patterns
// MessagePattern errors propagate to caller
@MessagePattern({ cmd: "get_user" })
async getUser(userId: string): Promise<User> {
  const user = await this.repo.findOne({ where: { id: userId } });
  if (!user) {
    throw new RpcException("User not found"); // Received by caller
  }
  return user;
}

// EventPattern errors should be handled locally
@EventPattern("order.created")
async handleOrderCreated(data: OrderCreatedEvent): Promise<void> {
  try {
    await this.processOrder(data);
  } catch (error) {
    // Log and potentially retry - don"t throw
    this.logger.error("Failed to process order event", error);
    await this.deadLetterQueue.add(data);
  }
}
```

Reference: [NestJS Microservices](https://docs.nestjs.com/microservices/basics)

---

### 9.3 Use Message Queues for Background Jobs

**Impact: MEDIUM-HIGH** — Queues enable reliable background processing

Use `@nestjs/bullmq` for background job processing. Queues decouple long-running tasks from HTTP requests, enable retry logic, and distribute workload across workers. Use them for emails, file processing, notifications, and any task that shouldn"t block user requests.

**Incorrect (long-running tasks in HTTP handlers):**

```typescript
// Long-running tasks in HTTP handlers
@Controller("reports")
export class ReportsController {
  @Post()
  async generate(@Body() dto: GenerateReportDto): Promise<Report> {
    // This blocks the request for potentially minutes
    const data = await this.fetchLargeDataset(dto);
    const report = await this.processData(data); // Slow!
    await this.sendEmail(dto.email, report); // Can fail!
    return report; // Client times out
  }
}

// Fire-and-forget without retry
@Injectable()
export class EmailService {
  async sendWelcome(email: string): Promise<void> {
    // If this fails, email is never sent
    await this.mailer.send({ to: email, template: "welcome" });
    // No retry, no tracking, no visibility
  }
}

// Use setInterval for scheduled tasks
setInterval(async () => {
  await cleanupOldRecords();
}, 60000); // No error handling, memory leaks
```

**Correct (use BullMQ for background processing):**

```typescript
// Configure BullMQ
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: "localhost",
        port: 6379,
      },
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    }),
    BullModule.registerQueue(
      { name: "email" },
      { name: "reports" },
      { name: "notifications" },
    ),
  ],
})
export class QueueModule {}

// Producer: Add jobs to queue
@Injectable()
export class ReportsService {
  constructor(@InjectQueue("reports") private reportsQueue: Queue) {}

  async requestReport(dto: GenerateReportDto): Promise<{ jobId: string }> {
    // Return immediately, process in background
    const job = await this.reportsQueue.add("generate", dto, {
      priority: dto.urgent ? 1 : 10,
      delay: dto.scheduledFor ? Date.parse(dto.scheduledFor) - Date.now() : 0,
    });

    return { jobId: job.id };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.reportsQueue.getJob(jobId);
    return {
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
    };
  }
}

// Consumer: Process jobs
@Processor("reports")
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);

  @Process("generate")
  async generateReport(job: Job<GenerateReportDto>): Promise<Report> {
    this.logger.log(`Processing report job ${job.id}`);

    // Update progress
    await job.updateProgress(10);

    const data = await this.fetchData(job.data);
    await job.updateProgress(50);

    const report = await this.processData(data);
    await job.updateProgress(90);

    await this.saveReport(report);
    await job.updateProgress(100);

    return report;
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}

// Email queue with retry
@Processor("email")
export class EmailProcessor {
  @Process("send")
  async sendEmail(job: Job<SendEmailDto>): Promise<void> {
    const { to, template, data } = job.data;

    try {
      await this.mailer.send({
        to,
        template,
        context: data,
      });
    } catch (error) {
      // BullMQ will retry based on job options
      throw error;
    }
  }
}

// Usage
@Injectable()
export class NotificationService {
  constructor(@InjectQueue("email") private emailQueue: Queue) {}

  async sendWelcome(user: User): Promise<void> {
    await this.emailQueue.add(
      "send",
      {
        to: user.email,
        template: "welcome",
        data: { name: user.name },
      },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
  }
}

// Scheduled jobs
@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  constructor(@InjectQueue("maintenance") private queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Clean up old reports daily at midnight
    await this.queue.add(
      "cleanup",
      {},
      {
        repeat: { cron: "0 0 * * *" },
        jobId: "daily-cleanup", // Prevent duplicates
      },
    );

    // Send digest every hour
    await this.queue.add(
      "digest",
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        jobId: "hourly-digest",
      },
    );
  }
}

@Processor("maintenance")
export class MaintenanceProcessor {
  @Process("cleanup")
  async cleanup(): Promise<void> {
    await this.cleanupOldReports();
    await this.cleanupExpiredSessions();
  }

  @Process("digest")
  async sendDigest(): Promise<void> {
    const users = await this.getUsersForDigest();
    for (const user of users) {
      await this.emailQueue.add("send", { to: user.email, template: "digest" });
    }
  }
}

// Queue monitoring with Bull Board
import { BullBoardModule } from "@bull-board/nestjs";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: "email",
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: "reports",
      adapter: BullMQAdapter,
    }),
  ],
})
export class AdminModule {}
```

Reference: [NestJS Queues](https://docs.nestjs.com/techniques/queues)

---
