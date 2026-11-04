# Zealakit

<p align="center">
  <img src="https://github.com/zealakit/zealakit/blob/main/assets/images/zealakit-cover.jpg" alt="Zealakit logo" />
</p>

**基于 Recipe 的 TypeScript 项目脚手架。**

选择模板，只叠加需要的 Recipe，即可得到可直接安装的项目——包含依赖、脚本和 AI Agent 文档。无需全局安装 CLI。

[English](https://github.com/zealakit/zealakit/blob/main/README.md) · [Tiếng Việt](https://github.com/zealakit/zealakit/blob/main/README_VI.md) · [中文](https://github.com/zealakit/zealakit/blob/main/README_CN.md)

```bash
npx zealakit@latest my-app
```

---

## 为什么用 Zealakit？

常见 starter 要么太空，要么塞满用不到的东西。Zealakit 让你自由组合：

1. **模板（Template）** — Vite + React、Next.js、NestJS 或 Hono
2. **配方（Recipe）** — 可选层（Biome、Zustand、shadcn/ui、Drizzle、Storybook 等）

每个 Recipe 会带上对应的文件、包、脚本，以及（如有）Agent 指引。结果是一个普通的独立项目——可用 `npm`、`pnpm`、`yarn` 或 `bun`。

---

## 环境要求

- **Node.js 18+**

---

## 快速开始

```bash
npx zealakit@latest my-app
```

按提示完成（模板 → Recipe → 确认），然后：

```bash
cd my-app
npm install
npm run dev
```

### 非交互模式

```bash
npx zealakit@latest my-app -t next -w biome,shadcn-ui,storybook -y
npx zealakit@latest api -t nest -w biome,drizzle-orm -y
```

### 预览（不写入）

```bash
npx zealakit@latest my-app -t next -w biome,shadcn-ui,storybook --dry-run
```

- 不带 `-w` 时进入交互流程。
- `-y` 必须提供项目名，并跳过确认。

---

## CLI

```text
npx zealakit@latest [项目名] [选项]
```

| 选项                   | 说明                                       |
| ---------------------- | ------------------------------------------ |
| `-t, --template <id>`  | 基础模板（默认：`vite-react`）             |
| `-w, --with <recipes>` | 逗号分隔的 Recipe ID（如 `biome,zustand`） |
| `-y, --yes`            | 非交互模式（必须提供项目名）               |
| `--dry-run`            | 预览生成计划，不写入文件                   |
| `-h, --help`           | 显示帮助                                   |
| `-V, --version`        | 显示版本                                   |

**规则**

- 项目名需符合 npm 规范（小写、无空格）。
- 目标目录非空时会先确认；使用 `-y` 时直接拒绝覆盖。
- 无效或冲突的 Recipe 会在**写入任何文件之前**被拒绝。
- 生成会先写入临时目录并校验，通过后再提交——失败时不会留下半成品的新项目。
- `--dry-run` 使用与真实生成相同的解析与校验（含默认 Recipe 与 `dependsOn`），打印预览；就绪时退出码 `0`，被阻止时为 `3`。
- 退出码：`0` 成功或取消，`2` 用法错误，`3` 校验/兼容失败，`1` 意外错误。

---

## 模板

| ID           | 类型   | 技术栈                          | 开发命令            |
| ------------ | ------ | ------------------------------- | ------------------- |
| `vite-react` | 客户端 | Vite + React + TypeScript       | `npm run dev`       |
| `next`       | 全栈   | Next.js App Router + TypeScript | `npm run dev`       |
| `nest`       | 服务端 | NestJS + TypeScript             | `npm run start:dev` |
| `hono`       | 服务端 | Hono + TypeScript               | `npm run dev`       |

每个项目都包含 TypeScript、路径别名和 Agent 文档（`.agents/`、`AGENTS.md`）。

---

## Recipe

每个互斥分类（linter、state、UI 套件、HTTP 客户端、ORM 等）最多选 **一个** Recipe。

例外：

- **`storybook`** — 可与 UI 套件同时使用
- **`client-shared-pieces`** — 在 Vite / Next 上自动添加

| Recipe         | 分类        | 适用模板   | 内容                       |
| -------------- | ----------- | ---------- | -------------------------- |
| `biome`        | Linter      | 全部       | Lint + Format 脚本         |
| `eslint`       | Linter      | 全部       | ESLint flat config         |
| `zustand`      | State       | Vite、Next | Zustand 示例               |
| `nanostores`   | State       | Vite、Next | Nanostores 示例            |
| `hookform-zod` | Forms       | Vite、Next | React Hook Form + Zod      |
| `kyjs`         | HTTP        | Vite、Next | Ky 客户端                  |
| `axios`        | HTTP        | Vite、Next | Axios 客户端               |
| `antd`         | UI          | Vite、Next | Ant Design                 |
| `mui`          | UI          | Vite、Next | MUI                        |
| `shadcn-ui`    | UI          | Vite、Next | Tailwind + shadcn/ui       |
| `storybook`    | 文档 / 测试 | Vite、Next | Storybook 配置与脚本       |
| `type-orm`     | ORM         | Nest、Hono | TypeORM + Agent skill      |
| `mikro-orm`    | ORM         | Nest、Hono | MikroORM + Agent skill     |
| `drizzle-orm`  | ORM         | Nest、Hono | Drizzle + drizzle-kit 脚本 |

ORM Recipe 不绑定具体数据库驱动。脚手架完成后自行安装驱动（`pg`、`mysql2` 等），并参考 `.agents/skills/<orm>/` 中的说明。

### 示例

```bash
# SPA：Biome、Zustand、表单、Ky
npx zealakit@latest web -t vite-react -w biome,zustand,hookform-zod,kyjs -y

# Next.js：shadcn/ui + Storybook
npx zealakit@latest next-web -t next -w biome,shadcn-ui,storybook -y

# Nest API：Drizzle
npx zealakit@latest api-nest -t nest -w biome,drizzle-orm -y

# Hono API：TypeORM
npx zealakit@latest api-hono -t hono -w biome,type-orm -y
```

---

## 脚手架之后

```text
my-app/
├─ src/
├─ .agents/          # 供 coding agent 使用的 skills / rules
├─ AGENTS.md
├─ package.json
└─ …
```

Zealakit 只在创建时使用。生成结果是普通应用，运行时不依赖 Zealakit，也不强制包管理器。

用你喜欢的客户端安装并启动：

```bash
cd my-app
npm install && npm run dev
# 或：pnpm install && pnpm dev
# 或：yarn && yarn dev
# 或：bun install && bun run dev
```

---

## 常见问题

**Zealakit 会安装依赖吗？**  
不会。它只写入项目文件；请自行用包管理器安装。

**可以同时选两个 linter / state / UI 套件吗？**  
不可以——这些分类互斥。Storybook 除外。

**可以修改生成的代码吗？**  
可以。把它当作普通项目即可。

**支持 monorepo 吗？**  
暂不支持。每次运行创建一个独立项目。

---

## 工具用元数据

```bash
npx zealakit@latest info --json   # 别名：zealakit --info --json
```

在 stdout 上只输出一个 JSON 文档（不含其他内容）：CLI 名称/版本、模板（含交互流程和默认 recipe）、分类、recipe（兼容模板、冲突、依赖包）以及兼容性规则。键均为固定 id；仅在不兼容变更时才会修改 `schemaVersion`。不加 `--json` 时输出便于阅读的摘要。

---

## 许可证

[MIT](LICENSE)

源码：[github.com/zealakit/zealakit](https://github.com/zealakit/zealakit)
