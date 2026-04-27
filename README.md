# Nuxt 3 全栈任务管理系统

一个功能完整的全栈任务管理应用，基于 Nuxt 3、Vue 3、TypeScript 和 SQLite 构建，支持实时任务更新和用户认证。

## 功能特性

- **用户认证系统**：支持用户注册、登录、登出，使用 JWT 令牌认证
- **任务管理**：完整的任务 CRUD 操作，包括创建、查看、编辑和删除任务
- **任务筛选与排序**：支持按状态（全部/进行中/已完成）和字段（创建时间、更新时间、标题、优先级）进行筛选和排序
- **用户资料管理**：支持编辑用户资料、修改密码、上传用户头像
- **实时通信**：基于 WebSocket 的实时任务更新，任务变更实时推送到客户端
- **响应式设计**：适配不同屏幕尺寸的现代化界面
- **完整的测试套件**：包含前端和后端的单元测试

## 技术栈

### 前端技术栈
- **框架**：Nuxt 3.13.0（基于 Vue 3）
- **语言**：TypeScript
- **状态管理**：Vue 3 Composition API + Nuxt useState
- **HTTP 客户端**：内置 $fetch API
- **实时通信**：原生 WebSocket API

### 后端技术栈
- **框架**：Nuxt 3 Nitro 服务器
- **语言**：TypeScript
- **数据库**：SQLite（使用 better-sqlite3 驱动）
- **认证**：JSON Web Token (JWT)
- **密码加密**：bcryptjs
- **文件上传**：multer
- **实时通信**：ws (WebSocket 库)

### 开发与测试工具
- **测试框架**：Vitest
- **代码覆盖率**：@vitest/coverage-v8
- **Vue 测试工具**：@vue/test-utils
- **DOM 环境**：jsdom
- **类型检查**：TypeScript

## 安装与运行

### 环境要求
- Node.js >= 18.0.0
- 包管理器：npm / yarn / pnpm

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

### 开发模式运行

```bash
npm run dev
```

项目将在 `http://localhost:3000` 启动。

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

### 运行测试

```bash
# 运行所有测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行测试并退出
npm run test:run
```

## API 端点说明

### 认证相关端点

#### POST /api/auth/register
用户注册

**请求体：**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "用户ID",
      "username": "用户名",
      "avatar": "头像URL",
      "createdAt": "创建时间"
    },
    "token": "JWT令牌"
  }
}
```

#### POST /api/auth/login
用户登录

**请求体：**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

**响应：** 与注册相同

#### POST /api/auth/logout
用户登出

#### GET /api/auth/me
获取当前登录用户信息

**请求头：**
```
Authorization: Bearer <JWT令牌>
```

### 任务相关端点

#### GET /api/tasks
获取当前用户的任务列表

**请求头：**
```
Authorization: Bearer <JWT令牌>
```

**查询参数：**
- `status`: 任务状态筛选，可选值：`all`（默认）、`active`、`completed`
- `sortBy`: 排序字段，可选值：`createdAt`（默认）、`updatedAt`、`title`、`priority`
- `order`: 排序方向，可选值：`desc`（默认）、`asc`

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "任务ID",
      "userId": "用户ID",
      "title": "任务标题",
      "description": "任务描述",
      "completed": false,
      "createdAt": "创建时间",
      "updatedAt": "更新时间"
    }
  ]
}
```

#### POST /api/tasks
创建新任务

**请求头：**
```
Authorization: Bearer <JWT令牌>
```

**请求体：**
```json
{
  "title": "任务标题",
  "description": "任务描述（可选）"
}
```

#### GET /api/tasks/:id
获取单个任务详情

#### PUT /api/tasks/:id
更新任务

#### DELETE /api/tasks/:id
删除任务

### 用户相关端点

#### GET /api/user/profile
获取用户资料

**请求头：**
```
Authorization: Bearer <JWT令牌>
```

#### PUT /api/user/profile
更新用户资料

#### POST /api/user/change-password
修改密码

**请求体：**
```json
{
  "currentPassword": "当前密码",
  "newPassword": "新密码"
}
```

#### POST /api/user/avatar
上传用户头像

**请求头：**
```
Authorization: Bearer <JWT令牌>
Content-Type: multipart/form-data
```

## 数据库结构

### 数据库配置
- **数据库类型**：SQLite
- **数据库文件**：`server/data/app.db`
- **连接模式**：WAL (Write-Ahead Logging) 模式，提高并发性
- **外键约束**：启用

### 数据表结构

#### users 表
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | 用户唯一标识 |
| username | TEXT | NOT NULL, UNIQUE | 用户名，唯一 |
| passwordHash | TEXT | NOT NULL | 密码哈希值 |
| avatar | TEXT | NULL | 头像文件路径 |
| createdAt | TEXT | NOT NULL | 创建时间（ISO格式） |

#### tasks 表
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | 任务唯一标识 |
| userId | TEXT | NOT NULL, FOREIGN KEY | 关联用户ID，外键关联 users.id |
| title | TEXT | NOT NULL | 任务标题 |
| description | TEXT | NOT NULL, DEFAULT '' | 任务描述 |
| completed | INTEGER | NOT NULL, DEFAULT 0 | 是否完成（0=未完成，1=已完成） |
| createdAt | TEXT | NOT NULL | 创建时间（ISO格式） |
| updatedAt | TEXT | NOT NULL | 更新时间（ISO格式） |

### 索引
- `idx_users_username`：users 表 username 字段索引
- `idx_tasks_userId`：tasks 表 userId 字段索引
- `idx_tasks_createdAt`：tasks 表 createdAt 字段索引
- `idx_tasks_completed`：tasks 表 completed 字段索引

## 项目结构

```
fullstack/
├── .nuxt/                    # Nuxt 开发构建目录（自动生成）
├── .output/                  # 生产构建输出目录（自动生成）
├── components/               # Vue 组件
│   ├── AppNavbar.vue         # 应用导航栏组件
│   ├── UserAvatarUpload.vue  # 用户头像上传组件
│   └── WebSocketStatus.vue   # WebSocket 状态组件
├── composables/              # 可复用组合式函数
│   ├── useAuth.ts            # 认证相关逻辑
│   └── useWebSocket.ts       # WebSocket 相关逻辑
├── middleware/               # 路由中间件
│   └── auth.ts               # 认证中间件
├── pages/                    # 页面组件
│   ├── index.vue             # 首页
│   ├── login.vue             # 登录页
│   ├── register.vue          # 注册页
│   ├── tasks.vue             # 任务列表页
│   ├── profile.vue           # 用户资料页
│   └── change-password.vue   # 密码修改页
├── public/                   # 静态资源
│   └── avatars/              # 用户头像存储目录
├── scripts/                  # 脚本文件
│   ├── migrate-all.ts        # 全量迁移脚本
│   ├── migrate-users.ts      # 用户数据迁移脚本
│   └── migrate-tasks.ts      # 任务数据迁移脚本
├── server/                   # 服务端代码
│   ├── api/                  # API 端点
│   │   ├── auth/             # 认证相关 API
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   ├── me.ts
│   │   │   └── register.ts
│   │   ├── tasks/            # 任务相关 API
│   │   │   ├── index.ts
│   │   │   └── [id].ts
│   │   ├── user/             # 用户相关 API
│   │   │   ├── avatar.ts
│   │   │   ├── change-password.ts
│   │   │   └── profile.ts
│   │   └── hello.ts          # 示例 API
│   ├── data/                 # 数据存储目录
│   │   ├── app.db            # SQLite 数据库文件
│   │   ├── tasks.json        # 旧的任务数据文件（JSON格式）
│   │   └── users.json        # 旧的用户数据文件（JSON格式）
│   ├── lib/                  # 服务端库文件
│   │   └── database.ts       # 数据库连接（旧版）
│   ├── routes/               # 自定义路由
│   │   ├── avatars/          # 头像访问路由
│   │   │   └── [filename].get.ts
│   │   └── ws.ts             # WebSocket 路由
│   └── utils/                # 服务端工具函数
│       ├── avatarStorage.ts  # 头像存储工具
│       ├── database.ts       # 数据库工具
│       ├── db-helpers.ts     # 数据库辅助函数
│       ├── db-init.ts        # 数据库初始化
│       ├── db-migrate.ts     # 数据库迁移
│       ├── db.ts             # 数据库连接（新版）
│       ├── jwt.ts            # JWT 工具
│       ├── taskStorage.ts    # 任务存储工具
│       ├── userStorage.ts    # 用户存储工具
│       ├── validate-db-functionality.ts  # 数据库功能验证
│       ├── validate-db-schema.ts         # 数据库模式验证
│       ├── validation.ts     # 通用验证工具
│       ├── websocket.ts      # WebSocket 服务器
│       ├── ws-auth.ts        # WebSocket 认证
│       └── ws-events.ts      # WebSocket 事件
├── tests/                    # 测试文件
│   ├── composables/          # 组合式函数测试
│   │   └── useAuth.test.ts
│   ├── middleware/           # 中间件测试
│   │   └── auth.test.ts
│   ├── pages/                # 页面组件测试
│   │   ├── login.test.ts
│   │   ├── register.test.ts
│   │   └── tasks.test.ts
│   ├── server/               # 服务端测试
│   │   ├── api/              # API 测试
│   │   │   ├── auth/
│   │   │   │   ├── login.test.ts
│   │   │   │   ├── logout.test.ts
│   │   │   │   ├── me.test.ts
│   │   │   │   └── register.test.ts
│   │   │   └── tasks/
│   │   │       └── index.test.ts
│   │   ├── database.test.ts
│   │   ├── db-functionality.test.ts
│   │   ├── db-schema.test.ts
│   │   ├── jwt.test.ts
│   │   ├── taskStorage.test.ts
│   │   └── userStorage.test.ts
│   └── setup.ts              # 测试设置文件
├── app.vue                   # 根组件
├── nuxt.config.ts            # Nuxt 配置文件
├── package.json              # 项目依赖配置
├── tsconfig.json             # TypeScript 配置
└── vitest.config.ts          # Vitest 测试配置
```

## 认证机制

### JWT 认证流程

1. **用户登录**：
   - 用户在登录页面输入用户名和密码
   - 前端发送 POST 请求到 `/api/auth/login`
   - 后端验证用户名和密码
   - 验证成功后，生成 JWT 令牌
   - 返回用户信息和 JWT 令牌

2. **令牌存储**：
   - 前端使用 localStorage 存储 JWT 令牌
   - 同时存储用户基本信息
   - 认证状态通过 Vue 响应式状态管理

3. **请求认证**：
   - 对于需要认证的 API 端点，前端在请求头中携带 JWT 令牌：
     ```
     Authorization: Bearer <JWT令牌>
     ```
   - 后端从请求头提取令牌并验证
   - 验证通过后，从令牌中提取用户 ID 进行后续操作

4. **令牌验证**：
   - 后端使用 jsonwebtoken 库验证令牌的有效性
   - 检查令牌是否过期、签名是否正确
   - 从令牌 payload 中提取 userId 和 username

### WebSocket 认证

- WebSocket 连接时，通过 URL 参数传递 JWT 令牌：
  ```
  ws://localhost:3000/ws?token=<JWT令牌>
  ```
- 后端在 WebSocket 握手阶段验证令牌
- 验证通过后，建立 WebSocket 连接
- 支持自动重连机制，最多尝试 10 次重连

### 认证中间件

- 前端路由中间件 `auth.ts` 保护需要认证的页面
- 未登录用户访问受保护页面时，自动重定向到登录页
- 登录状态检查通过 `useAuth` 组合式函数的 `isAuthenticated` 属性

## 开发规范

### 代码风格
- 使用 TypeScript 进行类型安全开发
- 遵循 Vue 3 Composition API 规范
- 使用 Nuxt 3 的自动导入特性（composables、components、utils 自动导入）

### 目录规范
- 前端组件放在 `components/` 目录
- 可复用逻辑放在 `composables/` 目录
- 页面组件放在 `pages/` 目录
- 服务端代码放在 `server/` 目录
- API 端点放在 `server/api/` 目录
- 服务端工具函数放在 `server/utils/` 目录

### 命名规范
- 组件名使用 PascalCase（如 `AppNavbar.vue`）
- 组合式函数使用 camelCase 并以 `use` 开头（如 `useAuth.ts`）
- 文件名使用 kebab-case 或 camelCase
- 类型和接口使用 PascalCase
- 变量和函数使用 camelCase

### API 设计规范
- RESTful API 设计风格
- 统一的响应格式：
  ```json
  {
    "success": boolean,
    "data": any,
    "error": string | undefined
  }
  ```
- 适当的 HTTP 状态码：
  - 200: 成功
  - 201: 创建成功
  - 400: 客户端错误
  - 401: 未认证
  - 403: 禁止访问
  - 404: 资源不存在
  - 405: 方法不允许
  - 500: 服务器错误

### 数据库操作规范
- 使用 better-sqlite3 进行同步数据库操作
- 启用 WAL 模式提高并发性能
- 启用外键约束保证数据完整性
- 使用事务保证数据一致性
- 为常用查询字段创建索引

### 测试规范
- 使用 Vitest 作为测试框架
- 测试文件以 `.test.ts` 结尾
- 前端组件测试使用 @vue/test-utils
- 服务端测试直接导入模块进行测试
- 测试覆盖率目标：> 80%

### Git 提交规范
- 使用语义化提交信息
- 提交类型：
  - `feat`: 新功能
  - `fix`: 修复 bug
  - `docs`: 文档更新
  - `style`: 代码格式调整
  - `refactor`: 代码重构
  - `test`: 测试相关
  - `chore`: 构建/工具相关

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目。

---

**注意**：这是一个学习项目，用于演示 Nuxt 3 全栈开发的最佳实践。