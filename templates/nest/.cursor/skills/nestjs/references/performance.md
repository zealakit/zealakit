# Performance

**Section Impact: HIGH**

### 5.1 Use Async Lifecycle Hooks Correctly

**Impact: HIGH** — Improper async handling blocks application startup

NestJS lifecycle hooks (`onModuleInit`, `onApplicationBootstrap`, etc.) support async operations. However, misusing them can block application startup or cause race conditions. Understand the lifecycle order and use hooks appropriately.

**Incorrect (fire-and-forget async without await):**

```typescript
// Fire-and-forget async without await
@Injectable()
export class DatabaseService implements OnModuleInit {
  onModuleInit() {
    // This runs but doesn"t block - app starts before DB is ready!
    this.connect();
  }

  private async connect() {
    await this.pool.connect();
    console.log("Database connected");
  }
}

// Heavy blocking operations in constructor
@Injectable()
export class ConfigService {
  private config: Config;

  constructor() {
    // BLOCKS entire module instantiation synchronously
    this.config = fs.readFileSync("config.json");
  }
}
```

**Correct (return promises from async hooks):**

```typescript
// Return promise from async hooks
@Injectable()
export class DatabaseService implements OnModuleInit {
  private pool: Pool;

  async onModuleInit(): Promise<void> {
    // NestJS waits for this to complete before continuing
    await this.pool.connect();
    console.log("Database connected");
  }

  async onModuleDestroy(): Promise<void> {
    // Clean up resources on shutdown
    await this.pool.end();
    console.log("Database disconnected");
  }
}

// Use onApplicationBootstrap for cross-module dependencies
@Injectable()
export class CacheWarmerService implements OnApplicationBootstrap {
  constructor(
    private cache: CacheService,
    private products: ProductsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // All modules are initialized, safe to warm cache
    const products = await this.products.findPopular();
    await this.cache.warmup(products);
  }
}

// Heavy init in async hooks, not constructor
@Injectable()
export class ConfigService implements OnModuleInit {
  private config: Config;

  constructor() {
    // Keep constructor synchronous and fast
  }

  async onModuleInit(): Promise<void> {
    // Async loading in lifecycle hook
    this.config = await this.loadConfig();
  }

  private async loadConfig(): Promise<Config> {
    const file = await fs.promises.readFile("config.json");
    return JSON.parse(file.toString());
  }

  get<T>(key: string): T {
    return this.config[key];
  }
}

// Enable shutdown hooks in main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // Enable SIGTERM/SIGINT handling
  await app.listen(3000);
}
```

Reference: [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)

---

### 5.2 Use Lazy Loading for Large Modules

**Impact: MEDIUM** — Improves startup time for large applications

NestJS supports lazy-loading modules, which defers initialization until first use. This is valuable for large applications where some features are rarely used, serverless deployments where cold start time matters, or when certain modules have heavy initialization costs.

**Incorrect (loading everything eagerly):**

```typescript
// Load everything eagerly in a large app
@Module({
  imports: [
    UsersModule,
    OrdersModule,
    PaymentsModule,
    ReportsModule, // Heavy, rarely used
    AnalyticsModule, // Heavy, rarely used
    AdminModule, // Only admins use this
    LegacyModule, // Migration module, rarely used
    BulkImportModule, // Used once a month
  ],
})
export class AppModule {}

// All modules initialize at startup, even if never used
// Slow cold starts in serverless
// Memory wasted on unused modules
```

**Correct (lazy load rarely-used modules):**

```typescript
// Use LazyModuleLoader for optional modules
import { LazyModuleLoader } from "@nestjs/core";

@Injectable()
export class ReportsService {
  constructor(private lazyModuleLoader: LazyModuleLoader) {}

  async generateReport(type: string): Promise<Report> {
    // Load module only when needed
    const { ReportsModule } = await import("./reports/reports.module");
    const moduleRef = await this.lazyModuleLoader.load(() => ReportsModule);

    const reportsService = moduleRef.get(ReportsGeneratorService);
    return reportsService.generate(type);
  }
}

// Lazy load admin features with caching
@Injectable()
export class AdminService {
  private adminModule: ModuleRef | null = null;

  constructor(private lazyModuleLoader: LazyModuleLoader) {}

  private async getAdminModule(): Promise<ModuleRef> {
    if (!this.adminModule) {
      const { AdminModule } = await import("./admin/admin.module");
      this.adminModule = await this.lazyModuleLoader.load(() => AdminModule);
    }
    return this.adminModule;
  }

  async runAdminTask(task: string): Promise<void> {
    const moduleRef = await this.getAdminModule();
    const taskRunner = moduleRef.get(AdminTaskRunner);
    await taskRunner.run(task);
  }
}

// Reusable lazy loader service
@Injectable()
export class ModuleLoaderService {
  private loadedModules = new Map<string, ModuleRef>();

  constructor(private lazyModuleLoader: LazyModuleLoader) {}

  async load<T>(
    key: string,
    importFn: () => Promise<{ default: Type<T> } | Type<T>>,
  ): Promise<ModuleRef> {
    if (!this.loadedModules.has(key)) {
      const module = await importFn();
      const moduleType = "default" in module ? module.default : module;
      const moduleRef = await this.lazyModuleLoader.load(() => moduleType);
      this.loadedModules.set(key, moduleRef);
    }
    return this.loadedModules.get(key)!;
  }
}

// Preload modules in background after startup
@Injectable()
export class ModulePreloader implements OnApplicationBootstrap {
  constructor(private lazyModuleLoader: LazyModuleLoader) {}

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(async () => {
      await this.preloadModule(() => import("./reports/reports.module"));
    }, 5000); // 5 seconds after startup
  }

  private async preloadModule(importFn: () => Promise<any>): Promise<void> {
    try {
      const module = await importFn();
      const moduleType = module.default || Object.values(module)[0];
      await this.lazyModuleLoader.load(() => moduleType);
    } catch (error) {
      console.warn("Failed to preload module", error);
    }
  }
}
```

Reference: [NestJS Lazy Loading Modules](https://docs.nestjs.com/fundamentals/lazy-loading-modules)

---

### 5.3 Optimize Database Queries

**Impact: HIGH** — Database queries are typically the largest source of latency

Select only needed columns, use proper indexes, avoid over-fetching relations, and consider query performance when designing your data access. Most API slowness traces back to inefficient database queries.

**Incorrect (over-fetching data and missing indexes):**

```typescript
// Select everything when you need few fields
@Injectable()
export class UsersService {
  async findAllEmails(): Promise<string[]> {
    const users = await this.repo.find();
    // Fetches ALL columns for ALL users
    return users.map((u) => u.email);
  }

  async getUserSummary(id: string): Promise<UserSummary> {
    const user = await this.repo.findOne({
      where: { id },
      relations: [
        "posts",
        "posts.comments",
        "posts.comments.author",
        "followers",
      ],
    });
    // Over-fetches massive relation tree
    return { name: user.name, postCount: user.posts.length };
  }
}

// No indexes on frequently queried columns
@Entity()
export class Order {
  @Column()
  userId: string; // No index - full table scan on every lookup

  @Column()
  status: string; // No index - slow status filtering
}
```

**Correct (select only needed data with proper indexes):**

```typescript
// Select only needed columns
@Injectable()
export class UsersService {
  async findAllEmails(): Promise<string[]> {
    const users = await this.repo.find({
      select: ["email"], // Only fetch email column
    });
    return users.map((u) => u.email);
  }

  // Use QueryBuilder for complex selections
  async getUserSummary(id: string): Promise<UserSummary> {
    return this.repo
      .createQueryBuilder("user")
      .select("user.name", "name")
      .addSelect("COUNT(post.id)", "postCount")
      .leftJoin("user.posts", "post")
      .where("user.id = :id", { id })
      .groupBy("user.id")
      .getRawOne();
  }

  // Fetch relations only when needed
  async getFullProfile(id: string): Promise<User> {
    return this.repo.findOne({
      where: { id },
      relations: ["posts"], // Only immediate relation
      select: {
        id: true,
        name: true,
        email: true,
        posts: {
          id: true,
          title: true,
        },
      },
    });
  }
}

// Add indexes on frequently queried columns
@Entity()
@Index(["userId"])
@Index(["status"])
@Index(["createdAt"])
@Index(["userId", "status"]) // Composite index for common query pattern
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}

// Always paginate large datasets
@Injectable()
export class OrdersService {
  async findAll(page = 1, limit = 20): Promise<PaginatedResult<Order>> {
    const [items, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: "DESC" },
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
```

Persistence query patterns (joins, N+1, pagination) live in the installed ORM skill under `.cursor/skills/<type-orm|mikro-orm|drizzle-orm>/references/queries.md` — keep Nest performance guidance ORM-agnostic at the port boundary.

---

### 5.4 Use Caching Strategically

**Impact: HIGH** — Dramatically reduces database load and response times

Implement caching for expensive operations, frequently accessed data, and external API calls. Use NestJS CacheModule with appropriate TTLs and cache invalidation strategies. Don"t cache everything - focus on high-impact areas.

**Incorrect (no caching or caching everything):**

```typescript
// No caching for expensive, repeated queries
@Injectable()
export class ProductsService {
  async getPopular(): Promise<Product[]> {
    // Runs complex aggregation query EVERY request
    return this.productsRepo
      .createQueryBuilder("p")
      .leftJoin("p.orders", "o")
      .select("p.*, COUNT(o.id) as orderCount")
      .groupBy("p.id")
      .orderBy("orderCount", "DESC")
      .limit(20)
      .getMany();
  }
}

// Cache everything without thought
@Injectable()
export class UsersService {
  @CacheKey("users")
  @CacheTTL(3600)
  @UseInterceptors(CacheInterceptor)
  async findAll(): Promise<User[]> {
    // Caching user list for 1 hour is wrong if data changes frequently
    return this.usersRepo.find();
  }
}
```

**Correct (strategic caching with proper invalidation):**

```typescript
// Setup caching module
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [new KeyvRedis(config.get("REDIS_URL"))],
        ttl: 60 * 1000, // Default 60s
      }),
    }),
  ],
})
export class AppModule {}

// Manual caching for granular control
@Injectable()
export class ProductsService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private productsRepo: ProductRepository,
  ) {}

  async getPopular(): Promise<Product[]> {
    const cacheKey = "products:popular";

    // Try cache first
    const cached = await this.cache.get<Product[]>(cacheKey);
    if (cached) return cached;

    // Cache miss - fetch and cache
    const products = await this.fetchPopularProducts();
    await this.cache.set(cacheKey, products, 5 * 60 * 1000); // 5 min TTL
    return products;
  }

  // Invalidate cache on changes
  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productsRepo.save({ id, ...dto });
    await this.cache.del("products:popular"); // Invalidate
    return product;
  }
}

// Decorator-based caching with auto-interceptor
@Controller("categories")
@UseInterceptors(CacheInterceptor)
export class CategoriesController {
  @Get()
  @CacheTTL(30 * 60 * 1000) // 30 minutes - categories rarely change
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @Get(":id")
  @CacheTTL(60 * 1000) // 1 minute
  @CacheKey("category")
  findOne(@Param("id") id: string): Promise<Category> {
    return this.categoriesService.findOne(id);
  }
}

// Event-based cache invalidation
@Injectable()
export class CacheInvalidationService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  @OnEvent("product.created")
  @OnEvent("product.updated")
  @OnEvent("product.deleted")
  async invalidateProductCaches(event: ProductEvent) {
    await Promise.all([
      this.cache.del("products:popular"),
      this.cache.del(`product:${event.productId}`),
    ]);
  }
}
```

Reference: [NestJS Caching](https://docs.nestjs.com/techniques/caching)

---
