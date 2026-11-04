# Zealakit

<p align="center">
  <img src="https://github.com/zealakit/zealakit/blob/main/assets/images/zealakit-cover.jpg" alt="Zealakit logo" />
</p>

**Scaffold dự án TypeScript theo kiểu ghép recipe.**

Chọn template, thêm đúng những recipe cần dùng, nhận project sẵn sàng cài đặt — kèm dependencies, scripts và tài liệu cho AI agent. Không cần cài CLI global.

[English](https://github.com/zealakit/zealakit/blob/main/README.md) · [Tiếng Việt](https://github.com/zealakit/zealakit/blob/main/README_VI.md) · [中文](https://github.com/zealakit/zealakit/blob/main/README_CN.md)

```bash
npx zealakit@latest my-app
```

---

## Vì sao dùng Zealakit?

Hầu hết starter hoặc quá trống, hoặc nhồi quá nhiều thứ không cần. Zealakit cho phép bạn ghép:

1. **Template** — Vite + React, Next.js, NestJS hoặc Hono
2. **Recipe** — lớp tùy chọn (Biome, Zustand, shadcn/ui, Drizzle, Storybook, …)

Mỗi recipe mang theo file, package, script và hướng dẫn agent (khi có). Kết quả là một project độc lập bình thường — dùng `npm`, `pnpm`, `yarn` hoặc `bun`.

---

## Yêu cầu

- **Node.js 18+**

---

## Bắt đầu nhanh

```bash
npx zealakit@latest my-app
```

Trả lời các câu hỏi (template → recipe → xác nhận), rồi:

```bash
cd my-app
npm install
npm run dev
```

### Không tương tác

```bash
npx zealakit@latest my-app -t next -w biome,shadcn-ui,storybook -y
npx zealakit@latest api -t nest -w biome,drizzle-orm -y
```

### Xem trước (không ghi file)

```bash
npx zealakit@latest my-app -t next -w biome,shadcn-ui,storybook --dry-run
```

- Không có `-w` → CLI hỏi tương tác.
- `-y` bắt buộc có tên project và bỏ qua bước xác nhận.

---

## CLI

```text
npx zealakit@latest [tên-project] [options]
```

| Option                 | Mô tả                                                          |
| ---------------------- | -------------------------------------------------------------- |
| `-t, --template <id>`  | Template gốc (mặc định: `vite-react`)                          |
| `-w, --with <recipes>` | Danh sách recipe, cách nhau bởi dấu phẩy (vd. `biome,zustand`) |
| `-y, --yes`            | Chế độ không hỏi (bắt buộc có tên project)                     |
| `--dry-run`            | Xem trước kế hoạch, không ghi file                             |
| `-h, --help`           | Xem trợ giúp                                                   |
| `-V, --version`        | Xem phiên bản                                                  |

**Quy tắc**

- Tên project theo quy ước npm (chữ thường, không khoảng trắng).
- Thư mục đã có nội dung sẽ hỏi trước khi ghi đè; với `-y` sẽ bị từ chối.
- Recipe sai hoặc xung đột bị từ chối **trước khi** ghi file.
- Generate ghi vào thư mục tạm, validate, rồi mới commit — lỗi giữa chừng không để lại project mới bị dở dang.
- `--dry-run` dùng cùng logic resolve/validate như generate thật (kể cả recipe mặc định và `dependsOn`), in preview, thoát `0` nếu sẵn sàng hoặc `3` nếu bị chặn.
- Mã thoát: `0` thành công hoặc hủy, `2` dùng sai flag, `3` lỗi validate/tương thích, `1` lỗi bất ngờ.

---

## Template

| ID           | Loại       | Stack                           | Lệnh dev            |
| ------------ | ---------- | ------------------------------- | ------------------- |
| `vite-react` | Client     | Vite + React + TypeScript       | `npm run dev`       |
| `next`       | Full-stack | Next.js App Router + TypeScript | `npm run dev`       |
| `nest`       | Server     | NestJS + TypeScript             | `npm run start:dev` |
| `hono`       | Server     | Hono + TypeScript               | `npm run dev`       |

Mọi project đều có TypeScript, path alias và tài liệu agent (`.agents/`, `AGENTS.md`).

---

## Recipe

Mỗi nhóm độc quyền (linter, state, UI kit, HTTP client, ORM, …) chỉ chọn **tối đa một** recipe.

Ngoại lệ:

- **`storybook`** — có thể dùng kèm UI kit
- **`client-shared-pieces`** — tự thêm trên Vite và Next

| Recipe         | Nhóm           | Template               | Nội dung                     |
| -------------- | -------------- | ---------------------- | ---------------------------- |
| `biome`        | Linter         | Tất cả                 | Script lint + format         |
| `eslint`       | Linter         | Tất cả                 | ESLint flat config           |
| `zustand`      | State          | Vite, Next             | Ví dụ store Zustand          |
| `nanostores`   | State          | Vite, Next             | Ví dụ Nanostores             |
| `hookform-zod` | Forms          | Vite, Next             | React Hook Form + Zod        |
| `kyjs`         | HTTP           | Vite, Next             | Client Ky                    |
| `axios`        | HTTP           | Vite, Next             | Client Axios                 |
| `antd`         | UI             | Vite, Next             | Ant Design                   |
| `mui`          | UI             | Vite, Next             | MUI                          |
| `shadcn-ui`    | UI             | Vite, Next             | Tailwind + shadcn/ui         |
| `storybook`    | Docs / testing | Vite, Next             | Config + script Storybook    |
| `type-orm`     | ORM            | Nest, Hono, Next, Nuxt | TypeORM + skill agent        |
| `mikro-orm`    | ORM            | Nest, Hono, Next, Nuxt | MikroORM + skill agent       |
| `drizzle-orm`  | ORM            | Nest, Hono, Next, Nuxt | Drizzle + script drizzle-kit |
| `prisma`       | ORM            | Nest, Hono, Next, Nuxt | Prisma schema + migrate      |

Recipe ORM không gắn cứng driver. Sau khi scaffold, cài driver DB (`pg`, `mysql2`, …) và làm theo skill trong `.agents/skills/<orm>/`.

**Lưu ý hybrid:** ORM trên Next, Nuxt,.etc chỉ phù hợp project **nhỏ** — không mạnh bằng backend framework thuần. Nên dùng backend framework cho API production. CLI cảnh báo ở chế độ tương tác và `--dry-run`.

### Ví dụ

```bash
# SPA: Biome, Zustand, form, Ky
npx zealakit@latest web -t vite-react -w biome,zustand,hookform-zod,kyjs -y

# Next.js: shadcn/ui + Storybook
npx zealakit@latest next-web -t next -w biome,shadcn-ui,storybook -y

# Nest API: Drizzle
npx zealakit@latest api-nest -t nest -w biome,drizzle-orm -y

# Hono API: TypeORM
npx zealakit@latest api-hono -t hono -w biome,type-orm -y
```

---

## Sau khi scaffold

```text
my-app/
├─ src/
├─ .agents/          # Skill & rule cho coding agent
├─ AGENTS.md
├─ package.json
└─ …
```

Zealakit chỉ chạy lúc tạo project. App sinh ra không phụ thuộc runtime vào Zealakit và không ép buộc package manager.

Cài và chạy bằng client bạn chọn:

```bash
cd my-app
npm install && npm run dev
# hoặc: pnpm install && pnpm dev
# hoặc: yarn && yarn dev
# hoặc: bun install && bun run dev
```

---

## FAQ

**Zealakit có tự cài dependency không?**  
Không. Tool chỉ ghi file; bạn tự `install` bằng package manager của mình.

**Có chọn hai linter / state / UI kit được không?**  
Không — các nhóm đó độc quyền. Storybook là ngoại lệ.

**Sửa code sau khi generate được không?**  
Được. Coi như một project bình thường.

**Hỗ trợ monorepo chưa?**  
Chưa. Mỗi lần chạy tạo một project độc lập.

---

## Metadata cho tooling

```bash
npx zealakit@latest info --json   # alias: zealakit --info --json
```

In ra stdout đúng một tài liệu JSON (không kèm gì khác): tên/version CLI, template (kèm flow prompt và recipe mặc định), category, recipe (template tương thích, xung đột, package) và các quy tắc tương thích. Key là id cố định; `schemaVersion` chỉ đổi khi có thay đổi phá vỡ tương thích. Không có `--json` thì in bản tóm tắt dễ đọc.

---

## Giấy phép

[MIT](LICENSE)

Mã nguồn: [github.com/zealakit/zealakit](https://github.com/zealakit/zealakit)
