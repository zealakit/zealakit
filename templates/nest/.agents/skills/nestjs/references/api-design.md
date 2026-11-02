# API Design

**Section Impact: MEDIUM**

### 8.1 Use DTOs and Serialization for API Responses

**Impact: MEDIUM** — Response DTOs prevent accidental data exposure and ensure consistency

Never return entity objects directly from controllers. Use response DTOs with class-transformer"s `@Exclude()` and `@Expose()` decorators to control exactly what data is sent to clients. This prevents accidental exposure of sensitive fields and provides a stable API contract.

**Incorrect (returning entities directly or manual spreading):**

```typescript
// Return entities directly
@Controller("users")
export class UsersController {
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<User> {
    return this.usersService.findById(id);
    // Returns: { id, email, passwordHash, ssn, internalNotes, ... }
    // Exposes sensitive data!
  }
}

// Manual object spreading (error-prone)
@Get(":id")
async findOne(@Param("id") id: string) {
  const user = await this.usersService.findById(id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Easy to forget to exclude sensitive fields
    // Hard to maintain across endpoints
  };
}
```

**Correct (use class-transformer with @Exclude and response DTOs):**

```typescript
// Enable class-transformer globally
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.listen(3000);
}

// Entity with serialization control
@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  @Exclude() // Never include in responses
  passwordHash: string;

  @Column({ nullable: true })
  @Exclude()
  ssn: string;

  @Column({ default: false })
  @Exclude({ toPlainOnly: true }) // Exclude from response, allow in requests
  isAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  @Exclude()
  internalNotes: string;
}

// Now returning entity is safe
@Controller("users")
export class UsersController {
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<User> {
    return this.usersService.findById(id);
    // Returns: { id, email, name, createdAt }
    // Sensitive fields excluded automatically
  }
}

// For different response shapes, use explicit DTOs
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  @Transform(({ obj }) => obj.posts?.length || 0)
  postCount: number;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}

export class UserDetailResponseDto extends UserResponseDto {
  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => PostResponseDto)
  posts: PostResponseDto[];
}

// Controller with explicit DTOs
@Controller("users")
export class UsersController {
  @Get()
  @SerializeOptions({ type: UserResponseDto })
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((u) => plainToInstance(UserResponseDto, u));
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<UserDetailResponseDto> {
    const user = await this.usersService.findByIdWithPosts(id);
    return plainToInstance(UserDetailResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}

// Groups for conditional serialization
export class UserDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose({ groups: ["admin"] })
  email: string;

  @Expose({ groups: ["admin"] })
  createdAt: Date;

  @Expose({ groups: ["admin", "owner"] })
  settings: UserSettings;
}

@Controller("users")
export class UsersController {
  @Get()
  @SerializeOptions({ groups: ["public"] })
  async findAllPublic(): Promise<UserDto[]> {
    // Returns: { id, name }
  }

  @Get("admin")
  @UseGuards(AdminGuard)
  @SerializeOptions({ groups: ["admin"] })
  async findAllAdmin(): Promise<UserDto[]> {
    // Returns: { id, name, email, createdAt }
  }

  @Get("me")
  @SerializeOptions({ groups: ["owner"] })
  async getProfile(@CurrentUser() user: User): Promise<UserDto> {
    // Returns: { id, name, settings }
  }
}
```

Reference: [NestJS Serialization](https://docs.nestjs.com/techniques/serialization)

---

### 8.2 Use Interceptors for Cross-Cutting Concerns

**Impact: MEDIUM-HIGH** — Interceptors provide clean separation for cross-cutting logic

Interceptors can transform responses, add logging, handle caching, and measure performance without polluting your business logic. They wrap the route handler execution, giving you access to both the request and response streams.

**Incorrect (logging and transformation in every method):**

```typescript
// Logging in every controller method
@Controller("users")
export class UsersController {
  @Get()
  async findAll(): Promise<User[]> {
    const start = Date.now();
    this.logger.log("findAll called");

    const users = await this.usersService.findAll();

    this.logger.log(`findAll completed in ${Date.now() - start}ms`);
    return users;
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<User> {
    const start = Date.now();
    this.logger.log(`findOne called with id: ${id}`);

    const user = await this.usersService.findOne(id);

    this.logger.log(`findOne completed in ${Date.now() - start}ms`);
    return user;
  }
  // Repeated in every method!
}

// Manual response wrapping
@Get()
async findAll(): Promise<{ data: User[]; meta: Meta }> {
  const users = await this.usersService.findAll();
  return {
    data: users,
    meta: { timestamp: new Date(), count: users.length },
  };
}
```

**Correct (use interceptors for cross-cutting concerns):**

```typescript
// Logging interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`,
          );
        },
        error: (error) => {
          this.logger.error(
            `${method} ${url} ${error.status || 500} - ${Date.now() - now}ms`,
            error.stack,
          );
        },
      }),
    );
  }
}

// Response transformation interceptor
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: context.switchToHttp().getRequest().url,
        },
      })),
    );
  }
}

// Timeout interceptor
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException("Request timed out");
        }
        throw err;
      }),
    );
  }
}

// Apply globally or per-controller
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}

// Or per-controller
@Controller("users")
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  @Get()
  async findAll(): Promise<User[]> {
    // Clean business logic only
    return this.usersService.findAll();
  }
}

// Custom cache interceptor with TTL
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Only cache GET requests
    if (request.method !== "GET") {
      return next.handle();
    }

    const cacheKey = this.generateKey(request);
    const ttl = this.reflector.get<number>("cacheTTL", context.getHandler()) || 300;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return next.handle().pipe(
      tap((response) => {
        this.cacheManager.set(cacheKey, response, ttl);
      }),
    );
  }

  private generateKey(request: Request): string {
    return `cache:${request.url}:${JSON.stringify(request.query)}`;
  }
}

// Usage with custom TTL
@Get()
@SetMetadata("cacheTTL", 600)
@UseInterceptors(HttpCacheInterceptor)
async findAll(): Promise<User[]> {
  return this.usersService.findAll();
}

// Error mapping interceptor
@Injectable()
export class ErrorMappingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof EntityNotFoundError) {
          throw new NotFoundException(error.message);
        }
        if (error instanceof QueryFailedError) {
          if (error.message.includes("duplicate")) {
            throw new ConflictException("Resource already exists");
          }
        }
        throw error;
      }),
    );
  }
}
```

Reference: [NestJS Interceptors](https://docs.nestjs.com/interceptors)

---

### 8.3 Use Pipes for Input Transformation

**Impact: MEDIUM** — Pipes ensure clean, validated data reaches your handlers

Use built-in pipes like `ParseIntPipe`, `ParseUUIDPipe`, and `DefaultValuePipe` for common transformations. Create custom pipes for business-specific transformations. Pipes separate validation/transformation logic from controllers.

**Incorrect (manual type parsing in handlers):**

```typescript
// Manual type parsing in handlers
@Controller("users")
export class UsersController {
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<User> {
    // Manual validation in every handler
    const uuid = id.trim();
    if (!isUUID(uuid)) {
      throw new BadRequestException("Invalid UUID");
    }
    return this.usersService.findOne(uuid);
  }

  @Get()
  async findAll(
    @Query("page") page: string,
    @Query("limit") limit: string,
  ): Promise<User[]> {
    // Manual parsing and defaults
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    return this.usersService.findAll(pageNum, limitNum);
  }
}

// Type coercion without validation
@Get()
async search(@Query("price") price: string): Promise<Product[]> {
  const priceNum = +price; // NaN if invalid, no error
  return this.productsService.findByPrice(priceNum);
}
```

**Correct (use built-in and custom pipes):**

```typescript
// Use built-in pipes for common transformations
@Controller("users")
export class UsersController {
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<User> {
    // id is guaranteed to be a valid UUID
    return this.usersService.findOne(id);
  }

  @Get()
  async findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<User[]> {
    // Automatic defaults and type conversion
    return this.usersService.findAll(page, limit);
  }

  @Get("by-status/:status")
  async findByStatus(
    @Param("status", new ParseEnumPipe(UserStatus)) status: UserStatus,
  ): Promise<User[]> {
    return this.usersService.findByStatus(status);
  }
}

// Custom pipe for business logic
@Injectable()
export class ParseDatePipe implements PipeTransform<string, Date> {
  transform(value: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new BadRequestException("Invalid date format");
    }
    return date;
  }
}

@Get("reports")
async getReports(
  @Query("from", ParseDatePipe) from: Date,
  @Query("to", ParseDatePipe) to: Date,
): Promise<Report[]> {
  return this.reportsService.findBetween(from, to);
}

// Custom transformation pipes
@Injectable()
export class NormalizeEmailPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) return value;
    return value.trim().toLowerCase();
  }
}

// Parse comma-separated values
@Injectable()
export class ParseArrayPipe implements PipeTransform<string, string[]> {
  transform(value: string): string[] {
    if (!value) return [];
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
}

@Get("products")
async findProducts(
  @Query("ids", ParseArrayPipe) ids: string[],
  @Query("email", NormalizeEmailPipe) email: string,
): Promise<Product[]> {
  // ids is already an array, email is normalized
  return this.productsService.findByIds(ids);
}

// Sanitize HTML input
@Injectable()
export class SanitizeHtmlPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) return value;
    return sanitizeHtml(value, { allowedTags: [] });
  }
}

// Global validation pipe with transformation
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip non-DTO properties
    transform: true, // Auto-transform to DTO types
    transformOptions: {
      enableImplicitConversion: true, // Convert query strings to numbers
    },
    forbidNonWhitelisted: true, // Throw on extra properties
  }),
);

// DTO with transformation decorators
export class FindProductsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value?.split(","))
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

@Get()
async findAll(@Query() dto: FindProductsDto): Promise<Product[]> {
  // dto is already transformed and validated
  return this.productsService.findAll(dto);
}

// Pipe error customization
@Injectable()
export class CustomParseIntPipe extends ParseIntPipe {
  constructor() {
    super({
      exceptionFactory: (error) =>
        new BadRequestException(`${error} must be a valid integer`),
    });
  }
}

// Or use options on built-in pipes
@Get(":id")
async findOne(
  @Param(
    "id",
    new ParseIntPipe({
      errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE,
      exceptionFactory: () => new NotAcceptableException("ID must be numeric"),
    }),
  )
  id: number,
): Promise<Item> {
  return this.itemsService.findOne(id);
}
```

Reference: [NestJS Pipes](https://docs.nestjs.com/pipes)

---

### 8.4 Use API Versioning for Breaking Changes

**Impact: MEDIUM** — Versioning allows you to evolve APIs without breaking existing clients

Use NestJS built-in versioning when making breaking changes to your API. Choose a versioning strategy (URI, header, or media type) and apply it consistently. This allows old clients to continue working while new clients use updated endpoints.

**Incorrect (breaking changes without versioning):**

```typescript
// Breaking changes without versioning
@Controller("users")
export class UsersController {
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<User> {
    // Original response: { id, name, email }
    // Later changed to: { id, firstName, lastName, emailAddress }
    // Old clients break!
    return this.usersService.findOne(id);
  }
}

// Manual versioning in routes
@Controller("v1/users")
export class UsersV1Controller {}

@Controller("v2/users")
export class UsersV2Controller {}
// Inconsistent, error-prone, hard to maintain
```

**Correct (use NestJS built-in versioning):**

```typescript
// Enable versioning in main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // URI versioning: /v1/users, /v2/users
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Or header versioning: X-API-Version: 1
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: "X-API-Version",
    defaultVersion: "1",
  });

  // Or media type: Accept: application/json;v=1
  app.enableVersioning({
    type: VersioningType.MEDIA_TYPE,
    key: "v=",
    defaultVersion: "1",
  });

  await app.listen(3000);
}

// Version-specific controllers
@Controller("users")
@Version("1")
export class UsersV1Controller {
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<UserV1Response> {
    const user = await this.usersService.findOne(id);
    // V1 response format
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}

@Controller("users")
@Version("2")
export class UsersV2Controller {
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<UserV2Response> {
    const user = await this.usersService.findOne(id);
    // V2 response format with breaking changes
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.email,
      createdAt: user.createdAt,
    };
  }
}

// Per-route versioning - different versions for different routes
@Controller("users")
export class UsersController {
  @Get()
  @Version("1")
  findAllV1(): Promise<UserV1Response[]> {
    return this.usersService.findAllV1();
  }

  @Get()
  @Version("2")
  findAllV2(): Promise<UserV2Response[]> {
    return this.usersService.findAllV2();
  }

  @Get(":id")
  @Version(["1", "2"]) // Same handler for multiple versions
  findOne(@Param("id") id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Post()
  @Version(VERSION_NEUTRAL) // Available in all versions
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }
}

// Shared service with version-specific logic
@Injectable()
export class UsersService {
  async findOne(id: string, version: string): Promise<any> {
    const user = await this.repo.findOne({ where: { id } });

    if (version === "1") {
      return this.toV1Response(user);
    }
    return this.toV2Response(user);
  }

  private toV1Response(user: User): UserV1Response {
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
    };
  }

  private toV2Response(user: User): UserV2Response {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.email,
      createdAt: user.createdAt,
    };
  }
}

// Controller extracts version
@Controller("users")
export class UsersController {
  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @Headers("X-API-Version") version: string = "1",
  ): Promise<any> {
    return this.usersService.findOne(id, version);
  }
}

// Deprecation strategy - mark old versions as deprecated
@Controller("users")
@Version("1")
@UseInterceptors(DeprecationInterceptor)
export class UsersV1Controller {
  // All V1 routes will include deprecation warning
}

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    response.setHeader("Deprecation", "true");
    response.setHeader("Sunset", "Sat, 1 Jan 2025 00:00:00 GMT");
    response.setHeader("Link", "</v2/users>; rel="successor-version"");

    return next.handle();
  }
}
```

Reference: [NestJS Versioning](https://docs.nestjs.com/techniques/versioning)

---
