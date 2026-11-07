# Zealakit — Source Context (dùng để dán vào ChatGPT)

> **Snapshot:** repo `zealakit` v1.0.0-beta.3 · pnpm monorepo · Node.js >= 22.12 · TypeScript ESM strict.
> Tài liệu này mô tả **source code thực tế** trong `apps/`, `packages/`, `templates/`, `recipes/`.
> Lưu ý: repo **không có thư mục `src/` ở root**. Source nằm trong `apps/cli/src`, `packages/*/src`.
> `dist/` là output build của `tsup` — không sửa tay.

---

## 1. TL;DR

Zealakit là **CLI scaffolding dựa trên recipe**, không phải app frontend.

```
chọn template → chọn recipe → copy files
→ merge package.json/go.mod → fileTransforms → agent docs (.agents, .cursor)
→ validate output trong staging → atomic commit vào thư mục đích
```

- **Template** = app nền (Vite React, Next, Nest, Hono, Go API/worker…).
- **Recipe** = lớp tuỳ chọn (Biome, Zustand, MUI, Prisma, Storybook…), mang theo files, dependencies, scripts, transforms và hướng dẫn cho AI agent.
- **Discovery** = questionnaire phi kỹ thuật → chuẩn hoá thành requirements → matching/scoring → gợi ý template + recipe.
- **Info** = metadata query layer dùng chung cho `zealakit info`, JSON API, Discovery và programmatic API.
- Package publish lên npm là **`zealakit`** (root). Các package workspace `@zealakit/*` là **private**, được bundle vào `dist/index.js`.

Điểm cốt lõi cần nhớ khi làm việc với code:

1. **Core không được import ecosystem** (`packages/core` không phụ thuộc `packages/ecosystem-*`).
2. Mọi thứ đi qua **registry in-memory**; ecosystem đăng ký template/recipe + manifest adapter.
3. Không hardcode id template/recipe trong prompt/validation; dùng metadata từ registry/profile.
4. Scaffold luôn đi qua **plan → staging → validate → atomic commit**, không ghi trực tiếp vào đích.
5. Các enum (scope, category, capability…) chỉ định nghĩa trong `packages/core/src/constants/`.

---

## 2. Mental model & luồng chính

### 2.1 Ba trục dữ liệu

| Trục             | Ý nghĩa                                                                                                               | Nơi định nghĩa                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `Scope`          | Hình thái app được sinh ra: `client`, `server`, `hybrid`, `infrastructure`                                            | `packages/core/src/constants/scopes.ts` |
| `ProjectType`    | Ý định sản phẩm trong Discovery: `ui`, `server-api`, `background-worker`, `complete-product`                          | `constants/project-types.ts`            |
| `RecipeCategory` | Nhóm recipe: `linter`, `state`, `ui`, `form`, `fetcher`, `orm`, `infrastructure`, `utils`, `testing`, `documentation` | `constants/recipe-categories.ts`        |

`Scope` và `ProjectType` **khác nhau**:
- `Scope` là thuộc tính của template (Next là `hybrid`, Nest là `server`).
- `ProjectType` là nhánh ra quyết định của Discovery (UI, API, worker).
- `complete-product` có trong enum nhưng **chưa hỗ trợ** (`SUPPORTED_PROJECT_TYPES` chỉ có 3 giá trị đầu).

### 2.2 Luồng scaffold

```
CLI create
  → resolve config (flags hoặc prompt)
  → withDefaultRecipes(scope, ids)
  → validateRecipeIds
  → resolveRecipeDependencies (dependsOn, cycle, missing)
  → [--dry-run] buildScaffoldPlan + in preview
  → validateScaffoldInput (config + target dir)
  → scaffoldProject
       → buildScaffoldPlan
       → materialize vào thư mục staging tạm (os.tmpdir)
       → validateGeneratedOutput
       → commitStagedDirectory (rename/backup/rollback)
```

### 2.3 Luồng Discovery

```
answers (questionnaire)
  → validateDiscoveryAnswers
  → normalizeDiscoveryAnswers + pruneDiscoveryAnswers
  → resolveDiscoveryRequirements → ProjectRequirements
  → matchDiscovery
       → evaluateTemplateConstraints (hard gate)
       → scoreTemplate + rank
       → evaluateRecipeConstraints (hard gate + relevance)
       → scoreRecipe + selectNonConflictingRecipes
  → DiscoveryResult
  → CLI: review/sửa → đặt tên → scaffoldProject
  → JSON API: recommendations / validate / scaffold
```

---

## 3. Repository map

| Path                                   | Vai trò                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `apps/cli/src/index.ts`                | Entry Commander; đăng ký Node + Go ecosystem; mount `create`, `info`, `doctor`, `discovery` |
| `apps/cli/src/create.ts`               | Resolve config, dry-run, validate, gọi scaffold, in kết quả, exit code                      |
| `apps/cli/src/prompts.ts`              | Interactive create (mode picker, template, recipe steps)                                    |
| `apps/cli/src/prompt-labels.ts`        | Label/hint cho prompt từ registry metadata                                                  |
| `apps/cli/src/preview.ts`              | Format `ScaffoldPlan` cho `--dry-run`                                                       |
| `apps/cli/src/info.ts`                 | Format human/JSON cho `zealakit info`                                                       |
| `apps/cli/src/doctor.ts`               | Check Node + Go toolchain                                                                   |
| `apps/cli/src/discovery/`              | UI Discovery: `flow.ts`, `questionnaire.ts`, `present.ts`, `commands.ts`, `query.ts`        |
| `packages/core/src/constants/`         | Toàn bộ enum + type domain                                                                  |
| `packages/core/src/types.ts`           | `TemplateConfig`, `RecipeConfig`, `ScaffoldConfig`, `CliOptions`                            |
| `packages/core/src/registry/`          | Catalog mutable: `registerTemplate`, `registerRecipe`, lookup, defaults                     |
| `packages/core/src/compat.ts`          | Recipe × template compatibility + exclusive conflicts                                       |
| `packages/core/src/resolve-recipes.ts` | Expand `dependsOn`, phát hiện cycle/missing, thứ tự áp dụng                                 |
| `packages/core/src/scaffold/`          | `plan` → `copy` → `transforms` → `validate-output` → `commit`                               |
| `packages/core/src/profiles/`          | Discovery profiles cho template/recipe + resolve/validate                                   |
| `packages/core/src/discovery/`         | Questionnaire, requirements, matching/scoring/ranking, JSON API, feedback                   |
| `packages/core/src/info/`              | Metadata query layer (`getInfo`, filters, schema v4)                                        |
| `packages/core/src/prompts/steps.ts`   | Metadata của interactive create flow theo scope                                             |
| `packages/core/src/validation/`        | Validate project name, template, recipe ids, conflicts, target dir                          |
| `packages/core/src/diagnostics.ts`     | Diagnostic format + `ExitCode` + `ScaffoldValidationError`                                  |
| `packages/core/src/client.ts`          | `createZealakit()` programmatic API                                                         |
| `packages/ecosystem-node/`             | Registry 9 template Node + 20 recipe + npm manifest adapter                                 |
| `packages/ecosystem-go/`               | Registry 3 template Go + `go.mod` adapter + toolchain detection                             |
| `templates/node/<id>/`                 | Template Node thực tế                                                                       |
| `templates/go/<id>/`                   | Template Go thực tế                                                                         |
| `recipes/node/<id>/`                   | Recipe Node thực tế                                                                         |
| `recipes/go/`                          | Recipe Go (`postgres`, `mysql`, `mongodb`)                                                  |
| `tests/unit/`                          | Unit test cho info, discovery, plan, commit, transforms, API…                               |
| `tests/scaffold/`                      | Scaffold từng template + matrix + dependency                                                |
| `scripts/`                             | Test runner, pack smoke test, publish, xử lý dotfiles khi pack                              |
| `monitor/`                             | Dashboard nội bộ xem dependency (`pnpm monitor`)                                            |
| `docs/`                                | Contract maintainer: metadata layer, Discovery JSON API, programmatic API                   |

### 3.1 Dependency direction

```
constants/types
   ↑
registry ← ecosystem-node / ecosystem-go
   ↑
compat / resolve-recipes / validation
   ↑
scaffold
   ↑
info / profiles / discovery
   ↑
client (createZealakit)
   ↑
apps/cli
```

- `packages/core` **không** import `@zealakit/ecosystem-*`.
- CLI đăng ký ecosystem bằng `registerNodeEcosystem()` + `registerGoEcosystem()` trước khi chạy.
- Programmatic API nhận ecosystem qua `createZealakit({ ecosystems: [...] })`.

---

## 4. Data model

### 4.1 `TemplateConfig` (`packages/core/src/types.ts`)

```ts
type TemplateConfig = {
  id: string;
  name: string;
  label: string; // label trong picker
  scope: Scope;
  uiFramework?: UiFramework; // bỏ trống với server/infrastructure
  description: string;
  path: string; // vd "node/next", "go/gin-api"
  overlay?: string; // mặc định = id; dùng family id để share overlay
  srcDir?: string; // mặc định "src"; Nuxt dùng "app"
  devCommand?: string; // mặc định "npm run dev"
  ecosystem?: EcosystemId; // mặc định "node"
};
```

### 4.2 `RecipeConfig`

```ts
type RecipeConfig = {
  id: string;
  name: string;
  hint?: string;
  category: RecipeCategory | RecipeCategory[];
  supportedScopes: Scope[] | "all";
  uiFrameworks?: UiFramework[]; // bỏ trống = framework-agnostic
  exclusive?: boolean; // mỗi category chỉ chọn 1 exclusive
  default?: boolean; // tự áp dụng, không hiện trong prompt
  dependsOn?: string[]; // transitive, phải tồn tại, không cycle
  path?: string; // mặc định "node/<id>" qua defineRecipe
  ecosystem?: EcosystemId; // mặc định "node"
  packages: Record<string, string>;
  overlayPackages?: Record<string, Record<string, string>>;
  devDependencies: Record<string, string>;
  overlayDevDependencies?: Record<string, Record<string, string>>;
  scripts: Record<string, string>;
  fileTransforms?: Record<string, RecipeFileTransform[]>;
  finalize?: (targetDir: string) => void;
};
```

`RecipeFileTransform`:

```ts
type RecipeFileTransform = {
  file: string; // path tương đối trong staging, không được escape
  pattern?: RegExp; // dùng với replacement
  replacement?: string;
  append?: string; // thêm nếu chưa có, không ghi đè
};
```

- `append` và `pattern/replacement` **loại trừ nhau**.
- Pattern không match → **throw**, không silent no-op.
- Key của `fileTransforms` có thể là template id **hoặc** overlay id.

### 4.3 `ScaffoldConfig`

```ts
type ScaffoldConfig = {
  projectName: string;
  templateId: string;
  recipeIds: string[];
  targetDir?: string;
};
```

### 4.4 Discovery profiles

`TemplateProfile` (advisory, không chứa scope/uiFramework/ecosystem — lấy từ registry):

```ts
type TemplateProfile = {
  id: string;
  projectTypes: ProjectType[];
  purposes?: ProjectPurpose[];
  frontendModes?: FrontendMode[];
  delivery?: FrontendDelivery;
  backend?: { runtimes: BackendRuntime[]; frameworks?: BackendFramework[] };
  capabilities: Capability[];
  databases?: DatabaseType[];
  deploymentTargets?: DeploymentTarget[];
  architectureLevels?: ArchitectureLevel[];
  trafficExpectations?: ApiTrafficExpectation[];
};
```

`RecipeProfile` (chỉ mô tả recipe **thêm** gì; category/scope/uiFrameworks/dependsOn/exclusive lấy từ `RecipeConfig`):

```ts
type RecipeProfile = {
  id: string;
  capabilities: Capability[];
  projectTypes?: ProjectType[];
  requires?: Capability[];
  excludes?: Capability[];
  databases?: DatabaseType[];
  alwaysRelevant?: boolean;
};
```

Khi resolve, core merge với registry thành `ResolvedTemplateProfile` / `ResolvedRecipeProfile`
(thêm `scope`, `scopes`, `uiFramework`, `ecosystem`, `categories`, `dependsOn`, `conflicts`, `exclusive`).

> Quy ước: field optional bỏ trống = "không áp dụng/không claim", **không phải** "unknown" hay "unrestricted".
> Không dùng array rỗng để biểu diễn "mọi thứ".

### 4.5 Domain enums

| Enum                       | Giá trị                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `SCOPES`                   | `client`, `server`, `hybrid`, `infrastructure`                                                                                          |
| `ECOSYSTEMS`               | `node`, `go`                                                                                                                            |
| `PROJECT_TYPES`            | `ui`, `server-api`, `background-worker`, `complete-product`                                                                             |
| `SUPPORTED_PROJECT_TYPES`  | `ui`, `server-api`, `background-worker`                                                                                                 |
| `CAPABILITIES`             | `http-api`, `web-ui`, `database`, `external-api`, `background-processing`                                                               |
| `UI_FRAMEWORKS`            | `react`, `vue`, `svelte`                                                                                                                |
| `FRONTEND_MODES`           | `spa`, `ssg`, `ssr`, `islands`, `static`, `hybrid`                                                                                      |
| `FRONTEND_DELIVERIES`      | `vite`, `astro`, `next`, `nuxt`                                                                                                         |
| `BACKEND_RUNTIMES`         | `node`, `go`                                                                                                                            |
| `BACKEND_FRAMEWORKS`       | `hono`, `nest`, `gin`, `stdlib`                                                                                                         |
| `DATABASE_TYPES`           | `postgresql`, `mysql`, `sqlite`                                                                                                         |
| `DEPLOYMENT_TARGETS`       | `vps`, `container`, `serverless`, `static-hosting`                                                                                      |
| `ARCHITECTURE_LEVELS`      | `minimal`, `balanced`, `structured`                                                                                                     |
| `PROCESSING_MODELS`        | `scheduled`, `queue`, `continuous`, `manual`                                                                                            |
| `PROJECT_PURPOSES`         | `saas`, `business`, `internal-tool`, `developer-tool`, `api-service`, `ecommerce`, `content-platform`, `prototype`, `learning`, `other` |
| `SERVICE_TYPES`            | `rest`, `graphql`, `rpc`, `webhook` — chỉ `rest` được hỗ trợ                                                                            |
| `RECIPE_CATEGORIES`        | `linter`, `state`, `ui`, `form`, `fetcher`, `orm`, `infrastructure`, `utils`, `testing`, `documentation`                                |
| `RECIPE_INTERESTS`         | `state`, `form`, `ui`, `fetcher`, `orm`, `documentation`, `testing`                                                                     |
| `API_TRAFFIC_EXPECTATIONS` | `low`, `medium`, `high`, `very-high`                                                                                                    |

---

## 5. Registry & catalog

File: `packages/core/src/registry/catalog.ts`.

- `templates: Record<string, TemplateConfig>`
- `recipes: Record<string, RecipeConfig>`
- `recipeOrder: string[]` — **thứ tự đăng ký = thứ tự option trong prompt**.
- `registerTemplate` ghi đè theo id.
- `registerRecipe` giữ thứ tự lần đầu, ghi đè config nếu đăng ký lại.
- `withDefaultRecipes(scope, ids)` prepend các recipe `default: true` phù hợp scope, dedupe, giữ thứ tự user.
- `DEFAULT_TEMPLATE_ID = "vite-react"`.
- `getTemplateOverlayId(templateId)` trả `template.overlay ?? templateId`.

Hiện tại chỉ có **`client-shared-pieces`** là `default: true` (scope `client` + `hybrid`).

---

## 6. Compatibility & dependency resolution

### 6.1 `checkRecipeCompatibility` (`compat.ts`)

Trả `Incompatibility | undefined` theo thứ tự:

1. **scope**: `recipe.supportedScopes` phải chứa `template.scope` (hoặc `"all"`).
2. **ui-framework**: nếu recipe khai báo `uiFrameworks`, template phải có `uiFramework` nằm trong danh sách.
3. **overlay**: `resolveRecipeOverlay(recipeId, templateId)` phải tìm thấy overlay nếu recipe có thư mục `overlays/`.

Quy tắc overlay (`scaffold/paths.ts`):

- Không có `overlays/` → `kind: "none"` (hợp lệ).
- Có `overlays/` nhưng thiếu `<overlayId>` → `kind: "missing"` → **incompatible**, kèm danh sách overlay có sẵn.
- `overlayId = template.overlay ?? template.id`.

Đây là **single source of truth** cho prompt filtering, validation và `zealakit info`.

### 6.2 Conflict

- `getConflictingRecipes` chỉ xét recipe `exclusive: true` cùng category.
- Validation từ chối 2 exclusive cùng category.
- `storybook` là non-exclusive nên có thể đứng cạnh UI kit.

### 6.3 Dependency resolution (`resolve-recipes.ts`)

- DFS dependency-first, deterministic theo thứ tự selection.
- Thiếu recipe trong `dependsOn` → lỗi `missing` + `requiredBy`.
- Cycle → lỗi `cycle` kèm đường đi.
- Trả `recipeIds` (apply order), `selectedIds`, `autoInjected`.
- Hiện **chưa recipe nào dùng `dependsOn`**, nhưng toàn bộ pipeline đã hỗ trợ.

---

## 7. Scaffold pipeline (phần quan trọng nhất)

### 7.1 Plan — read-only (`scaffold/plan.ts`)

`buildScaffoldPlan(config, cwd, { requestedRecipeIds? })` **không ghi file**.

Nó thực hiện:

1. Resolve `dependsOn`; nếu lỗi → trả plan với `blockers`, không inventory.
2. Phân biệt `selectedIds` (user chọn) và `autoInjected` (dependency/default).
3. `validateScaffoldConfig` (name, template, recipe ids, conflicts, compatibility).
4. `getManifestAdapterForConfig(...).planMerges(...)`:
   - merge dependencies/devDependencies/scripts;
   - **package conflict là blocker** (2 recipe muốn version khác nhau).
5. Inventory file template + recipe theo thứ tự áp dụng:
   - template file → `action: "create"`;
   - recipe đè template → `"replace"` (bình thường);
   - cùng recipe (root → shared → overlay) đè nhau → `"replace"`;
   - 2 recipe khác nhau, **cùng bytes** → bỏ qua;
   - 2 recipe khác nhau, **khác bytes** → **warning**, recipe sau thắng (không phải blocker);
   - transform file → `"transform"` hoặc `"append"`.
6. Thêm warning ORM trên hybrid (Next/Nuxt/Astro hybrid).
7. Sort file theo path; trả:

```ts
type ScaffoldPlan = {
  config: ScaffoldConfig; // đã resolve dependencies
  targetDir: string; // path.resolve(cwd, projectName)
  destinationExists: boolean;
  selectedIds: string[];
  autoInjected: string[];
  files: PlannedFile[]; // { path, action, sources }
  packages: PackagePlan; // deps/devDeps/scripts/added*/conflicts
  checks: PlanCheck[]; // { id, ok, detail? }
  blockers: string[];
  warnings: string[];
};
```

`planIsReady(plan)` = `blockers.length === 0`.

### 7.2 Materialize (`scaffold/index.ts`)

Diễn ra trong **staging directory** (`fs.mkdtempSync(os.tmpdir(), "zealakit-stage-")`), không phải đích thật.

Thứ tự:

1. `copyTemplate(template.id, targetDir)`
   - copy toàn bộ template, bỏ `node_modules`, `dist`, `coverage`, `.turbo`, `.vite`, `vendor`, `*.tsbuildinfo`.
   - đổi `_gitignore` → `.gitignore` (npm không pack `.gitignore`).
2. `assertStagingSymlinksSafe(targetDir)`.
3. Với **từng recipe** theo thứ tự:
   - `copyRecipe(recipeId, templateId, targetDir)`:
     1. copy recipe root (trừ `shared/`, `overlays/`, `scaffold/`),
     2. copy `shared/`,
     3. copy `overlays/<overlayId>/` (bắt buộc nếu `overlays/` tồn tại).
   - `assertStagingSymlinksSafe`.
   - `foldIntoSrcDir(template, targetDir)`: nếu `template.srcDir` khác `src` (Nuxt → `app`), gộp `src/` vào `app/` rồi xoá `src/`.
   - `applyAgentEntry(recipe.id, targetDir)`: chèn các dòng từ `recipes/node/<id>/scaffold/agent-entry.md` vào `AGENTS.md` và `CLAUDE.md`.
   - `applyFileTransforms(recipe, template.id, targetDir)`.
4. Chạy `finalize(targetDir)` cho từng recipe (ví dụ Biome xoá `root: false` trong `biome.json`).
5. `getManifestAdapterForConfig(plan.config).applyMerges(targetDir, config)`.
6. `ensureCursorAgentsSymlink(targetDir)` — `.cursor` → `.agents`.

### 7.3 Validate output (`scaffold/validate-output.ts`)

Chạy trên staging, không network/install.

- Không được leak `overlays`, `shared`, `scaffold`, `pnpm-workspace.yaml`.
- Template có `srcDir` khác `src` không được còn `src/`.
- Project không được rỗng.
- `.agents` phải là directory; `.cursor` phải là symlink relative trỏ đúng `.agents`, không escape project.
- Mọi symlink trong cây không được trỏ ra ngoài staging.
- **Node:** `package.json` tồn tại, JSON hợp lệ, `name === projectName`; type của `version`, `type`, `packageManager`, `private`, `engines`; đủ dependencies/devDependencies/scripts của từng recipe (kể cả overlay packages); đủ dòng agent-entry trong `AGENTS.md`/`CLAUDE.md` nếu file tồn tại.
- **Go:** `go.mod` tồn tại, có `module`, module path chứa `projectName`; **không** có `package.json`.

Lỗi → `ScaffoldValidationError`.

### 7.4 Commit (`scaffold/commit.ts`)

`commitStagedDirectory(stageDir, targetDir)`:

- Target chưa tồn tại:
  - thử `rename(stageDir, targetDir)`;
  - nếu `EXDEV` → copy sang thư mục sibling `.${base}.zealakit-commit-*` rồi rename.
- Target đã tồn tại:
  - tạo backup sibling `.${base}.zealakit-backup-*`;
  - copy staging sang commit dir sibling;
  - `rename(target → backup)`;
  - `rename(commit → target)`;
  - nếu rename commit fail → rollback `backup → target`;
  - nếu rollback cũng fail → throw `ScaffoldCommitError` giữ lại cả backup và commitDir để recovery thủ công;
  - thành công → xoá backup + staging.

** guarantee:** target cũ không bao giờ bị xoá trước khi replacement sẵn sàng; lỗi filesystem được phân loại rõ.

### 7.5 Safety invariants

- `resolveStagingPath` chặn path escape (kể cả absolute path).
- `assertStagingRealPath` kiểm tra sau khi follow symlink.
- `assertStagingSymlinksSafe` quét toàn bộ cây, chặn symlink trỏ ra ngoài.
- `finalize` là trusted kit code nhưng vẫn phải dùng `resolveStagingPath` / `assertStagingRealPath` (xem Biome).
- Không bao giờ ghi trực tiếp vào target trước khi qua plan + staging + validate.

---

## 8. CLI

### 8.1 Commands

| Command                                                      | Mô tả                                            |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `zealakit create [project-name]`                             | Interactive (mode picker: manual hoặc Discovery) |
| `zealakit create <name> -t <template> -w <recipes> -y`       | Non-interactive                                  |
| `zealakit create <name> ... --dry-run`                       | In plan, không ghi file                          |
| `zealakit create --discover`                                 | Discovery tương tác                              |
| `zealakit create --discover --json`                          | Đọc 1 JSON request từ stdin, in 1 JSON response  |
| `zealakit create <name> --info --json`                       | Legacy alias của `info`                          |
| `zealakit info [--json] [filters]`                           | Metadata (schema v4)                             |
| `zealakit doctor [--json] [--min-go-version]`                | Check Node + Go                                  |
| `zealakit discovery query [--input file]`                    | Stateless JSON API (cùng contract)               |
| `zealakit discovery stats`                                   | Thống kê feedback local                          |
| `zealakit discovery feedback status\|enable\|disable\|clear` | Quản lý feedback local                           |

Flags của `create`:

- `-t, --template <id>`
- `-w, --with <recipes>` — comma-separated
- `-y, --yes`
- `--dry-run`
- `--discover`
- `--json` (chỉ hợp lệ với `--discover`)

Ràng buộc:

- `-y` **bắt buộc** có project name.
- `--discover` **không được** kết hợp `-y`, `-w`, `--dry-run`, `--template`.
- `--json` chỉ dùng với `--discover`; không kèm project name/`-t`/`-w`/`-y`/`--dry-run`.
- Root alias `zealakit [name] ...` vẫn tồn tại để backward-compatible.

### 8.2 Resolve config (`create.ts`)

- Nếu có project name **và** (`-w` hoặc `-y` hoặc `--dry-run`) → non-interactive, template mặc định `vite-react`.
- Ngược lại → prompt những gì còn thiếu (giữ `-t` nếu có).
- Trước khi expand `dependsOn`, validate recipe ids (id sai là lỗi user, không phải missing dependency).
- Sau đó `withDefaultRecipes` → `resolveRecipeDependencies` → validate target → scaffold.

`--dry-run` dùng `requestedRecipeIds` để preview phân biệt recipe user chọn và recipe auto-inject.

### 8.3 Exit codes (`diagnostics.ts`)

| Code           | Ý nghĩa                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `0 OK`         | Thành công hoặc user cancel                                                                    |
| `1 INTERNAL`   | Lỗi filesystem/không mong đợi, commit fail                                                     |
| `2 USAGE`      | Flag sai, thiếu argument, request JSON sai                                                     |
| `3 VALIDATION` | Template/recipe không hợp lệ, conflict, incompatible, dry-run bị block, output validation fail |

`ScaffoldValidationError` → `3`; mọi lỗi khác → `1`.
Discovery API map lỗi theo `docs/discovery-json-api.md` (invalid answers/selection → `3`).

---

## 9. Discovery engine

### 9.1 Questionnaire (`discovery/questionnaire/`)

- `DISCOVERY_QUESTIONS` là mảng metadata có `condition(answers)`; câu hỏi hiển thị theo nhánh.
- `getVisibleQuestions(answers)` lọc theo condition.
- `getQuestionOptions(question, answers)` lọc option theo nhánh.
- `pruneDiscoveryAnswers` xoá answer không còn relevant khi đổi nhánh.
- `normalizeDiscoveryAnswers` validate type/enum/unknown key và trả requirements.
- `NO_PREFERENCE = "no-preference"` cho câu optional single-select.

Các nhóm câu hỏi:

| Nhóm       | IDs                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root       | `projectType`                                                                                                                                           |
| UI         | `websiteKind`, `visitorActions`, `userAccounts`, `uiDataNeed`, `uiBackendApproach`, `contentChangeFrequency`, `uiTechPreference`                        |
| Server/API | `serviceGoals`, `serviceConsumers`, `apiStorageNeed`, `apiAuthNeed`, `apiBackgroundNeed`, `apiTrafficExpectation`, `backendRuntime`, `backendFramework` |
| Worker     | `workerTasks`, `workerSchedule`, `workerVolume`, `workerDataNeed`, `workerQueueNeed`                                                                    |

`complete-product` hiện bị chặn với thông báo "Coming soon".

### 9.2 Requirements (`discovery/requirements.ts`)

`ProjectRequirements` là union discriminated:

- `UiRequirements`: `projectType: "ui"`, `frontend?`, `externalApi?`
- `ServerApiRequirements`: `projectType: "server-api"`, `serviceType?`, `backend?`, `databaseKind?`, `trafficExpectation?`
- `WorkerRequirements`: `projectType: "background-worker"`, `processingModel?`, `backend?`, `databaseKind?`

Base fields: `scopes`, `capabilities`, `databases?`, `purpose?`, `architectureLevel?`, `deploymentTarget?`, `recipeInterests?`.

Helper quan trọng:

- `requiredCapabilities` = implied (theo projectType) + explicit + `external-api` nếu UI gọi API ngoài + `database` nếu có databases.
- `TEMPLATE_OWNED_CAPABILITIES = ["web-ui", "http-api", "background-processing"]` — recipe **không thể** thay thế các capability này.
- `requiresDataIntegration` = có capability `database` hoặc có `databases`.

### 9.3 Matching (`discovery/matching/`)

**Template — hard constraints** (`evaluateTemplateConstraints`):

- `projectTypes` phải chứa projectType.
- Nếu user chọn `scopes`, template scope phải nằm trong đó.
- `serviceType` phải supported (chỉ `rest`).
- Template phải có mọi **template-owned** capability cần thiết.
- Database:
  - template phải có `http-api` hoặc `database`;
  - UI template phải có ít nhất 1 database recipe tương thích;
  - server/worker không có DB recipe → **warning**, không loại.
- `nosql` → fail (chưa hỗ trợ).
- Runtime/framework/UI framework/delivery/mode nếu user chỉ định → phải khớp.
- Capability do recipe có thể bù → warning, không fail.

**Template — scoring** (`TEMPLATE_SCORE_WEIGHTS`, tổng 100, normalize trên weight áp dụng được):

| Tiêu chí                              | Weight |
| ------------------------------------- | ------ |
| `projectType`                         | 22     |
| `capabilities`                        | 18     |
| `runtimeFramework`                    | 14     |
| `frameworkEcosystem`                  | 12     |
| `scalabilityFit` (chỉ khi có traffic) | 10     |
| `scopeFit`                            | 8      |
| `architectureFit`                     | 8      |
| `purposeFit`                          | 4      |
| `architecture`                        | 2      |
| `deployment`                          | 2      |

**Recipe — hard constraints + relevance** (`evaluateRecipeConstraints`):

- projectTypes (nếu khai báo), scopes, `requires`, `excludes`.
- UI framework nếu user chỉ định.
- `dependsOn` phải có trong registry.
- Conflict với recipe đã chọn.
- `checkRecipeCompatibility` với template.
- Relevant nếu: capability overlap, database match, recipe interest, hoặc `alwaysRelevant`.
- Nếu capability đã được template cung cấp và không có novelty → **irrelevant + warning redundant**.

**Recipe — scoring** (`RECIPE_SCORE_WEIGHTS`):

| Tiêu chí       | Weight |
| -------------- | ------ |
| `capabilities` | 40     |
| `scope`        | 20     |
| `framework`    | 15     |
| `projectType`  | 15     |
| `integration`  | 10     |

**Ranking:**

- Template: compatible trước; score giảm dần; tie-break theo ecosystem preference → architecture suitability → simplicity → id.
- Recipe: role (`recommended` > `dependency` > `irrelevant` > `excluded`); relevant; compatible; score; id.
- `selectNonConflictingRecipes`: greedy theo rank, block các recipe conflict.
- Recommended recipes = exclusive winners + non-exclusive recipe bù capability cần.
- Dependency của recipe được chọn được promote thành role `dependency`.
- Recipe thua exclusivity → role `excluded` + warning.

### 9.4 `DiscoveryResult`

```ts
{
  templates: TemplateMatchResult[];      // templateId, score, compatible, reasons, warnings
  recipes: RecipeMatchResult[];          // recipeId, score, compatible, relevant, role, reasons, warnings
  recommendedTemplateId?: string;        // template compatible đầu tiên sau sort
  recommendedRecipeIds: string[];        // direct picks
}
```

`RecipeMatchRole`: `recommended`, `dependency`, `excluded`, `irrelevant`.

Reason codes ổn định ở `matching/reasons.ts` (`project-type-match`, `capability-missing`, `template-incompat`, `not-relevant`…).

---

## 10. Discovery JSON API (stateless)

Contract: `docs/discovery-json-api.md`, `DISCOVERY_API_SCHEMA_VERSION = 1`.

```bash
echo '{"schemaVersion":1,"operation":"questions","answers":{}}' \
  | zealakit create --discover --json

# hoặc
zealakit discovery query --input request.json
```

Operations:

| Operation         | Input                                                             | Output                                                    |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `questions`       | `answers?`                                                        | câu hỏi kế tiếp + progress                                |
| `recommendations` | `answers` đầy đủ                                                  | requirements + ranked templates/recipes                   |
| `validate`        | `answers?`, `selection`                                           | `{ valid, errors, warnings, resolvedRecipeIds }`          |
| `scaffold`        | `answers?`, `selection`, `project`, `confirmation.confirmed=true` | `{ projectName, templateId, recipeIds, outputDirectory }` |

Đặc điểm:

- **Stateless**: caller gửi lại toàn bộ answers mỗi lần; không session, không đọc feedback.
- **Deterministic**: cùng request → cùng response.
- **Validate không ghi file**.
- **Scaffold** luôn validate lại selection, project name, target dir; từ chối target non-empty (`TARGET_EXISTS`); chạy đúng pipeline `scaffoldProject`.
- Error codes ổn định trong `DISCOVERY_API_ERROR_CODES`; không parse message.
- stdout chỉ có JSON; diagnostics không bị trộn vào stdout.

Envelope:

```jsonc
{ "schemaVersion": 1, "ok": true, "operation": "questions", "data": {} }
{ "schemaVersion": 1, "ok": false, "operation": null, "error": { "code": "", "message": "", "details": [] } }
```

---

## 11. Feedback local (Discovery)

- Lưu local, không upload network.
- Store mặc định **enabled** (`feedbackEnabled: true`), tối đa **100 session** (`DISCOVERY_FEEDBACK_MAX_SESSIONS`).
- Env:
  - `ZEALAKIT_CONFIG_DIR` — đổi thư mục config;
  - `ZEALAKIT_DISCOVERY_FEEDBACK=0|false|off|no` — tắt.
- Record chỉ gồm ID, status, thời lượng, cờ thay đổi recommendation — **không** lưu nội dung answers.
- Lỗi ghi feedback **không bao giờ** làm fail scaffold.
- `discovery stats` đọc aggregate; `feedback enable|disable|clear` quản lý.

---

## 12. Info metadata layer

- `INFO_SCHEMA_VERSION = 4`.
- `getInfo(filter, { cli })` trả envelope `{ schemaVersion, command: "info", filters, data }`.
- `queryMetadata(rawFilter, options)` validate raw string filter → `{ ok, filter, data }` hoặc `{ ok: false, errors }`.
- Typed helpers: `getTemplateMetadata`, `getRecipeMetadata`, `getEcosystemMetadata`, `getScopeMetadata`, `getProjectTypeMetadata`, `getUiFrameworkMetadata`, `getRecipeCategoryMetadata`, `getInfoRules`, `getTemplateIds`, `getRecipeIds`.
- Kết quả là **snapshot** đã clone/sort; mutate response không ảnh hưởng registry.
- Filter combine bằng **AND**; giá trị lạ bị reject (không silent ignore); filter mâu thuẫn trả mảng rỗng.
- Relation ids trong response bị giới hạn theo filtered set.
- `--discover` chỉ attach profile + lọc entry eligible; **không** chạy questionnaire/scoring.

Filters:

| Filter        | Template                            | Recipe                                |
| ------------- | ----------------------------------- | ------------------------------------- |
| `ecosystem`   | `template.ecosystem ?? "node"`      | `recipe.ecosystem ?? path prefix`     |
| `scope`       | exact scope                         | supportedScopes includes hoặc `"all"` |
| `projectType` | profile includes                    | profile includes hoặc omitted = all   |
| `uiFramework` | exact                               | `uiFrameworks` includes hoặc agnostic |
| `templateId`  | exact                               | compatible với template đó            |
| `recipeId`    | compatible với recipe đó            | exact                                 |
| `category`    | có recipe compatible trong category | category chứa                         |
| `discovery`   | có profile + attach discovery       | có profile + attach discovery         |

Ownership:

| Data                                | Owner                          |
| ----------------------------------- | ------------------------------ |
| Enum, scope, project type, category | `packages/core/src/constants/` |
| Template/recipe registry            | `packages/ecosystem-*`         |
| Discovery profiles                  | `packages/core/src/profiles/`  |
| Query/normalization/filter          | `packages/core/src/info/`      |
| CLI flags/output                    | `apps/cli/src/info.ts`         |
| Constraints/scoring/ranking         | `packages/core/src/discovery/` |

---

## 13. Ecosystem & nội dung hiện có

### 13.1 Node (`packages/ecosystem-node`)

- `registerNodeEcosystem()` idempotent; đăng ký 9 template, 20 recipe, `nodeManifestAdapter`.
- Template:

| id                   | scope  | uiFramework | Ghi chú                                |
| -------------------- | ------ | ----------- | -------------------------------------- |
| `vite-react`         | client | react       | default template                       |
| `vite-vue`           | client | vue         |                                        |
| `vite-svelte`        | client | svelte      | SvelteKit SPA, file-based routing      |
| `astro-react-client` | client | react       | static/SSG/islands                     |
| `astro-react-hybrid` | hybrid | react       | SSR/Actions/Sessions                   |
| `next`               | hybrid | react       | App Router                             |
| `nuxt`               | hybrid | vue         | `srcDir: "app"`                        |
| `nest`               | server | —           | DDD/hexagonal, dev `npm run start:dev` |
| `hono`               | server | —           | lightweight API                        |

- Recipe (20): `biome`, `eslint`, `zustand`, `pinia`, `nanostores`, `client-shared-pieces`, `hookform-zod`, `vee-validate-zod`, `kyjs`, `axios`, `antd`, `mui`, `shadcn-ui`, `nuxt-ui`, `shadcn-vue`, `storybook`, `type-orm`, `mikro-orm`, `drizzle-orm`, `prisma`.
- ORM recipe: `supportedScopes: ["server", "hybrid"]`, `exclusive: true`, profile `projectTypes: ["server-api", "ui"]` (UI bao gồm hybrid).
- `client-shared-pieces` là recipe `default` cho client/hybrid.
- `defineRecipe` tự set `path: node/<id>` và `ecosystem: "node"`.

### 13.2 Go (`packages/ecosystem-go`)

- `registerGoEcosystem()` idempotent; đăng ký 3 template, 3 recipe (`postgres`, `mysql`, `mongodb`) + `goManifestAdapter`.
- Template: `stdlib-api`, `gin-api` (server), `stdlib-worker` (infrastructure).
- `detectGoEnvironment()` check PATH, `go version`, `go env`; version parse/compare ở `version.ts`.
- **Recipe Go** hiện có `postgres`, `mysql` (`database/sql`) và `mongodb` (official Go Driver v2).
- `validateProjectName` theo Go module naming; output validate `go.mod`, cấm `package.json`.

### 13.3 Manifest adapters

`ManifestAdapter` (`scaffold/manifest.ts`):

```ts
type ManifestAdapter = {
  planMerges(config): PackagePlan;
  applyMerges(targetDir, config): void;
  validateProjectName(name): ValidationResult;
};
```

- Adapter đăng ký theo `EcosystemId`; `getManifestAdapter` throw nếu chưa đăng ký.
- `resolveTemplateEcosystem` lấy `template.ecosystem ?? "node"`.
- Node adapter: `planPackageMerges` + `mergePackageJson` + npm name rules.
- Go adapter: `go.mod` merge + Go name rules.

---

## 14. Template & recipe filesystem conventions

### 14.1 Template

```
templates/<ecosystem>/<id>/
  package.json / go.mod
  src/ (hoặc app/ với Nuxt)
  .agents/            # skills/rules cho app được sinh ra
  AGENTS.md
  CLAUDE.md
  .cursor -> .agents  # symlink
  _gitignore          # được đổi tên thành .gitignore khi scaffold
```

### 14.2 Recipe

```
recipes/<ecosystem>/<id>/
  shared/                 # copy cho mọi template
  overlays/<overlayId>/   # bắt buộc nếu overlays/ tồn tại
  scaffold/agent-entry.md # dòng chèn vào AGENTS.md / CLAUDE.md
  .agents/                # copy vào app
  .cursor -> .agents      # symlink
  ...files khác           # copy trực tiếp
```

Thứ tự copy: **root → shared → overlay**. Nhờ vậy overlay có thể ghi đè shared/root.

Recipe có thể có `finalize(targetDir)` chạy sau tất cả recipe copy; dùng cho logic không biểu diễn được bằng regex/append. Mọi write phải nằm trong staging root.

---

## 15. Testing & quality gates

```bash
pnpm check        # Biome (lint + format, gồm markdown table)
pnpm typecheck    # core, ecosystems, cli, tests, scripts, monitor
pnpm test         # unit + scaffold in-process
pnpm test:unit
pnpm test:scaffold
pnpm test:pack    # build → pack → tarball smoke test (release gate)
pnpm test <filter...>   # lọc theo test name
```

- Test runner: `scripts/test.ts` dùng `node --test` qua `tsx`.
- `tests/unit/` cover info schema, discovery API, questionnaire, matching, plan, commit, transforms, symlink integrity, exit codes…
- `tests/scaffold/` cover từng template + matrix + recipe dependencies.
- `scripts/test-e2e-pack.ts` kiểm tra tarball thực sự publish được.
- `pnpm monitor` mở dashboard dependency nội bộ.

---

## 16. Invariants & gotchas (rất quan trọng khi chỉnh code)

1. **Không có root `src/`** — đừng tạo file ở `src/`; đặt đúng `apps/cli/src` hoặc `packages/*/src`.
2. **Không sửa `dist/`** — build lại bằng `pnpm build`.
3. **Core → ecosystem là cấm**. Nếu cần hành vi ecosystem, thêm vào `ManifestAdapter` hoặc registration, không import.
4. **Không hardcode id** template/recipe trong prompt, validation, info. Dùng registry + `compat.ts` + profile.
5. **Không duplicate enum** ngoài `packages/core/src/constants/`.
6. **Overlay all-or-nothing**: hễ recipe có `overlays/`, mọi template nó hỗ trợ phải có overlay tương ứng; thiếu = incompatible.
7. **`overlayId`** là `template.overlay ?? template.id`, không phải lúc nào cũng là template id.
8. **Nuxt fold**: recipe `src/` được gộp vào `app/`; không được để lại `src/` top-level.
9. **`.cursor` luôn là symlink → `.agents`**, không được là directory thật.
10. **npm pack làm mất `.gitignore`** → dùng `_gitignore` + `scripts/pack-dotfiles.ts`.
11. **Package conflict là blocker**, còn file conflict giữa 2 recipe chỉ là warning (recipe sau thắng). Đừng đổi ngầm định này nếu không có lý do.
12. **Transform fail phải throw** — không silent no-op.
13. **Discovery profiles là bắt buộc để matching**: entry đã đăng ký nhưng không có profile → template/recipe bị coi là incompatible.
14. **Template-owned capabilities** (`web-ui`, `http-api`, `background-processing`) không thể bù bằng recipe.
15. **`complete-product` chưa hỗ trợ**; `SUPPORTED_PROJECT_TYPES` chỉ 3.
16. **Chỉ `rest` service type** được hỗ trợ; `graphql`/`rpc`/`webhook` fail rõ ràng.
17. **Discovery chưa mô hình hoá NoSQL** (`DATABASE_TYPES` chỉ có postgresql/mysql/sqlite); recipe `mongodb` vẫn chọn thủ công qua CLI/Info.
18. **Svelte dùng SvelteKit SPA** (`vite-svelte`): file-based routing dưới `src/routes/`, routes chỉ wire screen từ `src/features/`; không có SSR.
19. **Go chưa có recipe** → DB/ORM trên Go chưa được hỗ trợ; template Go vẫn eligible nhưng có warning.
20. **Feedback local mặc định bật**; lỗi ghi feedback không được làm fail scaffold.
21. **Programmatic API chưa publish subpath** `/api`; chỉ dùng được từ workspace source (`@zealakit/core`).
22. **ESM `.js` extension** trong import TypeScript là bắt buộc (`from "./types.js"`).
23. **Package conflict / output validation** dùng version pin chính xác trong recipe; đổi version phải đổi test pack nếu cần.
24. **`scaffoldProject` luôn dùng staging**; đừng thêm write trực tiếp vào `targetDir` trong recipe/finalize.
25. **Exit code 2 vs 3**: flag sai/JSON sai = 2; nội dung selection/config sai = 3.

---

## 17. “Sửa gì thì vào đâu?”

| Muốn thay đổi                | File/khu vực                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Thêm template                | `packages/ecosystem-<eco>/src/registry/templates.ts` + `templates/<eco>/<id>/`                          |
| Thêm recipe                  | `packages/ecosystem-node/src/registry/recipes/<id>.ts` + export trong `index.ts` + `recipes/node/<id>/` |
| Thêm overlay cho recipe      | `recipes/node/<id>/overlays/<overlayId>/`                                                               |
| Thêm Discovery profile       | `packages/core/src/profiles/template-profiles/index.ts` hoặc `recipe-profiles/index.ts`                 |
| Thêm enum/domain value       | `packages/core/src/constants/<name>.ts` + export ở `constants/index.ts`                                 |
| Đổi scoring/ranking          | `packages/core/src/discovery/matching/` (weights, scoring, constraints, ranking)                        |
| Thêm câu hỏi Discovery       | `packages/core/src/discovery/questionnaire/questions.ts` + types + resolve                              |
| Đổi interactive prompt       | `packages/core/src/prompts/steps.ts` (metadata) + `apps/cli/src/prompts.ts` (render)                    |
| Đổi scaffold copy/transform  | `packages/core/src/scaffold/`                                                                           |
| Đổi manifest merge           | `packages/ecosystem-<eco>/src/manifest/`                                                                |
| Thêm filter/field cho `info` | `packages/core/src/info/` + `apps/cli/src/info.ts`                                                      |
| Đổi JSON API                 | `packages/core/src/discovery/api/` + `docs/discovery-json-api.md`                                       |
| Đổi CLI flags/exit code      | `apps/cli/src/` + `packages/core/src/diagnostics.ts`                                                    |
| Thêm ngôn ngữ/tài liệu       | `README.md`, `README_VI.md`, `README_CN.md`, `docs/`                                                    |

---

## 18. Glossary

| Thuật ngữ        | Nghĩa trong repo                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Template         | App nền được copy đầu tiên                                                                           |
| Recipe           | Lớp tuỳ chọn áp lên template                                                                         |
| Overlay          | Biến thể file của recipe cho một template family                                                     |
| Scope            | Hình thái template (`client`/`server`/`hybrid`/`infrastructure`)                                     |
| Project type     | Nhánh ý định Discovery (`ui`/`server-api`/`background-worker`)                                       |
| Capability       | Năng lực hệ thống cần có (`web-ui`, `http-api`, `database`, `external-api`, `background-processing`) |
| Profile          | Metadata advisory cho Discovery, tách khỏi registry config                                           |
| Manifest adapter | Lớp merge `package.json` (Node) hoặc `go.mod` (Go)                                                   |
| Staging          | Thư mục tạm nơi project được sinh ra trước khi commit                                                |
| Plan             | Mô tả read-only những gì sẽ được tạo/merge/transform                                                 |
| Blocker          | Lỗi khiến plan không thể thực thi                                                                    |
| Discovery        | Questionnaire + matching để gợi ý setup                                                              |
| `info`           | Metadata query layer + CLI command                                                                   |
| Feedback         | Session local (IDs only) phục vụ thống kê Discovery                                                  |

---

## 19. Đánh giá nhanh source (review)

### Điểm mạnh

- **Tách lớp rất rõ**: constants → registry/ecosystem → engine → CLI; `core` không phụ thuộc ecosystem.
- **Scaffold an toàn**: plan read-only, staging tách biệt, validate trước commit, commit có backup/rollback; chặn path traversal và symlink escape.
- **Metadata có một nguồn**: `info/`, `profiles/`, `registry/` không duplicate mapping; `info` trả snapshot thay vì object registry.
- **Discovery deterministic**: constraints/scoring/ranking thuần, không I/O; reason codes ổn định; JSON API stateless và có schema version.
- **Test coverage rộng**: unit cho info/discovery/plan/commit/transforms + scaffold từng template + pack smoke test.
- **Quy ước nhất quán**: recipe folder layout, overlay family, agent docs, `.cursor` symlink, ESM `.js` import.

### Rủi ro / nợ kỹ thuật nên biết

1. **Profile drift**: mỗi template/recipe đăng ký phải có profile cùng id. CLI giờ gọi `validateProfiles()` lúc khởi động và fail-fast; programmatic API vẫn chưa tự validate.
2. **Svelte hiện chỉ có SvelteKit SPA**: `vite-svelte` dùng `@sveltejs/adapter-static` + `ssr = false`, chưa có template Svelte SSR/hybrid/server.
3. **`complete-product`** vẫn có trong enum nhưng không được hỗ trợ; CLI, Discovery `questions`, `recommendations`, và `validate` đều trả lỗi/thông báo nhất quán.
4. **`discovery/api/operations.ts`** đã tách parse request sang `parse.ts`; phần còn lại vẫn gồm nhiều operation trong một file (~584 dòng). Có thể tách tiếp nếu contract thay đổi lớn.
5. **Schema versioning thủ công**: đổi shape `info` phải bump `INFO_SCHEMA_VERSION` + cập nhật `docs/metadata-query-layer.md` + `scripts/test-e2e-pack.ts`; đổi Discovery API phải cập nhật `docs/discovery-json-api.md`. Không có codegen/type-level guard giữa doc và implementation.
6. **Programmatic API chưa publish**: `@zealakit/*` là private workspace package; consumer bên ngoài chỉ có CLI. Đừng thiết kế feature chỉ dựa vào `createZealakit()` nếu chưa có kế hoạch publish subpath.
7. **Recipe version pin** nằm rải trong từng file registry; update dependency phải chạy `pnpm test:pack` để chắc tarball vẫn đúng.

### Gợi ý cải thiện (không bắt buộc)

- Cân nhắc tách tiếp `operations.ts` thành `questions.ts` / `recommendations.ts` / `selection.ts` / `scaffold.ts`.
- Cân nhắc validate profile trong programmatic API với ecosystem được đăng ký.

---

## 20. Prompt gợi ý để dán kèm vào ChatGPT

> Đây là source context của repo **zealakit** — một CLI scaffolding dựa trên recipe, không phải app frontend.
> Hãy đọc kỹ các invariant ở mục 16 trước khi đề xuất code.
> Khi trả lời:
> - Chỉ rõ file cần sửa và lý do.
> - Không hardcode template/recipe id; dùng registry, `compat.ts`, profile.
> - Không import ecosystem package từ `packages/core`.
> - Giữ nguyên pipeline plan → staging → validate → atomic commit.
> - Nêu rõ ảnh hưởng đến `info --json` (schema v4) và Discovery JSON API (schema v1) nếu có.
> - Nếu thêm enum/field, chỉ rõ nơi định nghĩa trong `packages/core/src/constants/` và nơi export.
> - Đề xuất test tương ứng trong `tests/unit/` hoặc `tests/scaffold/`.
