# Testing

**Section Impact: MEDIUM-HIGH**

### 6.1 Use Supertest for E2E Testing

**Impact: HIGH** — Validates the full request/response cycle

End-to-end tests use Supertest to make real HTTP requests against your NestJS application. They test the full stack including middleware, guards, pipes, and interceptors. E2E tests catch integration issues that unit tests miss.

**Incorrect (no proper E2E setup or teardown):**

```typescript
// Only unit test controllers
describe("UsersController", () => {
  it("should return users", async () => {
    const service = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new UsersController(service as any);

    const result = await controller.findAll();

    expect(result).toEqual([]);
    // Doesn"t test: routes, guards, pipes, serialization
  });
});

// E2E tests without proper setup/teardown
describe("Users API", () => {
  it("should create user", async () => {
    const app = await NestFactory.create(AppModule);
    // No proper initialization
    // No cleanup after test
    // Hits real database
  });
});
```

**Correct (proper E2E setup with Supertest):**

```typescript
// Proper E2E test setup
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("UsersController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same config as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("/users (POST)", () => {
    it("should create a user", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({ name: "John", email: "john@test.com" })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty("id");
          expect(res.body.name).toBe("John");
          expect(res.body.email).toBe("john@test.com");
        });
    });

    it("should return 400 for invalid email", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({ name: "John", email: "invalid-email" })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain("email");
        });
    });
  });

  describe("/users/:id (GET)", () => {
    it("should return 404 for non-existent user", () => {
      return request(app.getHttpServer())
        .get("/users/non-existent-id")
        .expect(404);
    });
  });
});

// Testing with authentication
describe("Protected Routes (e2e)", () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "test@test.com", password: "password" });

    authToken = loginResponse.body.accessToken;
  });

  it("should return 401 without token", () => {
    return request(app.getHttpServer()).get("/users/me").expect(401);
  });

  it("should return user profile with valid token", () => {
    return request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe("test@test.com");
      });
  });
});

// Database isolation for E2E tests
describe("Orders API (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env.test", // Test database config
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get(DataSource);
    await app.init();
  });

  beforeEach(async () => {
    // Clean database between tests
    await dataSource.synchronize(true);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });
});
```

Reference: [NestJS E2E Testing](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing)

---

### 6.2 Mock External Services in Tests

**Impact: HIGH** — Ensures fast, reliable, deterministic tests

Never call real external services (APIs, databases, message queues) in unit tests. Mock them to ensure tests are fast, deterministic, and don"t incur costs. Use realistic mock data and test edge cases like timeouts and errors.

**Incorrect (calling real APIs and databases):**

```typescript
// Call real APIs in tests
describe("PaymentService", () => {
  it("should process payment", async () => {
    const service = new PaymentService(new StripeClient(realApiKey));
    // Hits real Stripe API!
    const result = await service.charge("tok_visa", 1000);
    // Slow, costs money, flaky
  });
});

// Use real database
describe("UsersService", () => {
  beforeEach(async () => {
    await connection.query("DELETE FROM users"); // Modifies real DB
  });

  it("should create user", async () => {
    const user = await service.create({ email: "test@test.com" });
    // Side effects on shared database
  });
});

// Incomplete mocks
const mockHttpService = {
  get: jest.fn().mockResolvedValue({ data: {} }),
  // Missing error scenarios, missing other methods
};
```

**Correct (mock all external dependencies):**

```typescript
// Mock HTTP service properly
describe("WeatherService", () => {
  let service: WeatherService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WeatherService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WeatherService);
    httpService = module.get(HttpService);
  });

  it("should return weather data", async () => {
    const mockResponse = {
      data: { temperature: 72, humidity: 45 },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    };

    httpService.get.mockReturnValue(of(mockResponse));

    const result = await service.getWeather("NYC");

    expect(result).toEqual({ temperature: 72, humidity: 45 });
  });

  it("should handle API timeout", async () => {
    httpService.get.mockReturnValue(throwError(() => new Error("ETIMEDOUT")));

    await expect(service.getWeather("NYC")).rejects.toThrow(
      "Weather service unavailable",
    );
  });

  it("should handle rate limiting", async () => {
    httpService.get.mockReturnValue(
      throwError(() => ({
        response: { status: 429, data: { message: "Rate limited" } },
      })),
    );

    await expect(service.getWeather("NYC")).rejects.toThrow(
      TooManyRequestsException,
    );
  });
});

// Mock repository instead of database
describe("UsersService", () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  it("should find user by id", async () => {
    const mockUser = { id: "1", name: "John", email: "john@test.com" };
    repo.findOne.mockResolvedValue(mockUser);

    const result = await service.findById("1");

    expect(result).toEqual(mockUser);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: "1" } });
  });
});

// Create mock factory for complex SDKs
function createMockStripe(): jest.Mocked<Stripe> {
  return {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  } as any;
}

// Mock time for time-dependent tests
describe("TokenService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should expire token after 1 hour", async () => {
    const token = await service.createToken();

    // Fast-forward time
    jest.advanceTimersByTime(61 * 60 * 1000);

    expect(await service.isValid(token)).toBe(false);
  });
});
```

Reference: [Jest Mocking](https://jestjs.io/docs/mock-functions)

---

### 6.3 Use Testing Module for Unit Tests

**Impact: HIGH** — Enables proper isolated testing with mocked dependencies

Use `@nestjs/testing` module to create isolated test environments with mocked dependencies. This ensures your tests run fast, don"t depend on external services, and properly test your business logic in isolation.

**Incorrect (manual instantiation bypassing DI):**

```typescript
// Instantiate services manually without DI
describe("UsersService", () => {
  it("should create user", async () => {
    // Manual instantiation bypasses DI
    const repo = new UserRepository(); // Real repo!
    const service = new UsersService(repo);

    const user = await service.create({ name: "Test" });
    // This hits the real database!
  });
});

// Test implementation details
describe("UsersController", () => {
  it("should call service", async () => {
    const service = { create: jest.fn() };
    const controller = new UsersController(service as any);

    await controller.create({ name: "Test" });

    expect(service.create).toHaveBeenCalled(); // Tests implementation, not behavior
  });
});
```

**Correct (use Test.createTestingModule with mocked dependencies):**

```typescript
// Use Test.createTestingModule for proper DI
import { Test, TestingModule } from "@nestjs/testing";

describe("UsersService", () => {
  let service: UsersService;
  let repo: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should save and return user", async () => {
      const dto = { name: "John", email: "john@test.com" };
      const expectedUser = { id: "1", ...dto };

      repo.save.mockResolvedValue(expectedUser);

      const result = await service.create(dto);

      expect(result).toEqual(expectedUser);
      expect(repo.save).toHaveBeenCalledWith(dto);
    });

    it("should throw on duplicate email", async () => {
      repo.findOne.mockResolvedValue({ id: "1", email: "test@test.com" });

      await expect(
        service.create({ name: "Test", email: "test@test.com" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const user = { id: "1", name: "John" };
      repo.findOne.mockResolvedValue(user);

      const result = await service.findById("1");

      expect(result).toEqual(user);
    });

    it("should throw NotFoundException when not found", async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById("999")).rejects.toThrow(NotFoundException);
    });
  });
});

// Testing guards and interceptors
describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it("should allow when no roles required", () => {
    const context = createMockExecutionContext({ user: { roles: [] } });
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it("should allow admin for admin-only route", () => {
    const context = createMockExecutionContext({ user: { roles: ["admin"] } });
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["admin"]);

    expect(guard.canActivate(context)).toBe(true);
  });
});

function createMockExecutionContext(
  request: Partial<Request>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as ExecutionContext;
}
```

Reference: [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

---
