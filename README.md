# Enterprise AI Customer Service Platform

企业级智能客服与知识库平台 monorepo。

## Workspaces

- `apps/admin-web`: Web 坐席工作台与后台管理端
- `apps/customer-h5`: 独立 H5 与嵌入式 H5 客服端
- `apps/mobile-flutter`: Flutter iOS/Android 客户端
- `services/platform-api`: 平台主业务 API
- `services/message-gateway`: 实时消息与在线状态网关
- `services/ai-service`: 模型网关、RAG 编排、AI 决策
- `services/worker-jobs`: 文档解析、切片、索引与离线任务
- `packages/contracts`: 前后端共享接口契约
- `packages/design-tokens`: 设计令牌与主题约定
- `infra/docker`: 本地开发与私有化部署编排

## Tooling

- Node workspace manager: `pnpm`
- Frontend build system: `Vite`
- Python package manager: `uv`
- Shared frontend package scope: `@leka/*`
- Flutter verification script: `scripts/verify-mobile-flutter.sh`

## Environment

- 根级环境参考文件是 [`.env.example`](/Users/west/dev/code/west/west-ai-agent/.env.example)
- `VITE_` 前缀用于 Web/H5
- `APP_` 前缀用于 Python 服务和 Flutter 编译时变量
- `AI_SERVICE_*` 用于模型网关和检索配置
- `POSTGRES_`、`REDIS_`、`MINIO_`、`OPENSEARCH_` 用于 Docker 依赖

如果你希望根级脚本读取当前 shell 变量，先在仓库根目录执行：

```bash
cp .env.example .env
set -a
source .env
set +a
```

## Install

```bash
pnpm install
```

Python 服务用 `uv` 管理依赖。如果本机尚未安装：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Local Development

### 1. Start infra dependencies

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

默认会启动：

- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- MinIO API: `127.0.0.1:9000`
- MinIO Console: `127.0.0.1:9001`
- OpenSearch: `127.0.0.1:9200`

更多说明见 [infra/docker/README.md](/Users/west/dev/code/west/west-ai-agent/infra/docker/README.md)。

如果要用私有化交付版基础设施编排：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d
```

### 2. Start frontend apps

```bash
pnpm dev:admin
pnpm dev:h5
```

### 3. Start Python services

分别在对应目录执行：

```bash
cd services/platform-api && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
cd services/message-gateway && uv run uvicorn app.main:app --host 127.0.0.1 --port 8010
cd services/ai-service && uv run uvicorn app.main:app --host 127.0.0.1 --port 8020
```

离线任务示例：

```bash
cd services/worker-jobs && uv run worker-jobs --job smoke
```

### 4. Flutter

如果本机已安装 Flutter SDK：

```bash
FLUTTER_BIN=/path/to/flutter pnpm test:mobile-flutter
```

## Verification

### Monorepo regression

```bash
pnpm verify
```

覆盖：

- `apps/admin-web`: typecheck + production build
- `apps/customer-h5`: typecheck + production build
- `services/platform-api`: pytest
- `services/message-gateway`: pytest
- `services/ai-service`: pytest
- `services/worker-jobs`: pytest

### Smoke test with managed stack

```bash
pnpm test:smoke
```

该命令会自动拉起隔离测试栈和本地服务，然后验证：

- `platform-api` 登录、用户、工单、留言、历史、摘要接口
- `ai-service` provider 列表和 `/chat/completions`
- `message-gateway` WebSocket 收发、`message.ack`、历史消息接口

测试栈默认使用独立端口，不会占用本机常驻的 `5432/6379/9000/9200`。

如果服务已经在本机运行，也可以只执行在线烟测：

```bash
pnpm test:smoke:local
```

### Playwright E2E

首次安装浏览器：

```bash
pnpm test:e2e:install
```

运行完整 E2E：

```bash
pnpm test:e2e
```

`test:e2e` 会使用和 smoke 相同的隔离测试栈，并在结束后自动清理。

辅助命令：

```bash
pnpm e2e:stack:up
pnpm e2e:stack:down
pnpm test:e2e:headed
pnpm test:e2e:debug
```

### Flutter verification

```bash
pnpm test:mobile-flutter
```

如果 Flutter 不在 `PATH`，脚本会优先尝试 `/Users/west/dev/env/flutter/bin/flutter`。也可以显式指定：

```bash
FLUTTER_BIN=/path/to/flutter pnpm test:mobile-flutter
```

Android 交付脚本：

```bash
pnpm mobile:android:doctor
pnpm mobile:android:doctor:fix
pnpm mobile:android:build:debug
pnpm mobile:android:build:release
```

`doctor` 会检查推荐 NDK `28.2.13676358`，`build` 会先强制执行 preflight 再构建 APK。

## Backup & Restore

```bash
bash scripts/backup-platform-data.sh
bash scripts/restore-platform-data.sh /absolute/path/to/backup-dir
```

脚本会优先读取根目录 `.env`，如果不存在则回退到 [`.env.example`](/Users/west/dev/code/west/west-ai-agent/.env.example)。

## Private Deployment Notes

- `infra/docker/docker-compose.yml` 当前承载的是本地开发和单机私有化基础依赖，不包含业务服务镜像编排
- 私有化部署时建议：
  - 先将 PostgreSQL、Redis、MinIO、OpenSearch 作为基础设施独立部署
  - 再为 `platform-api`、`message-gateway`、`ai-service`、`worker-jobs` 分别准备镜像和运行配置
  - 将模型密钥和业务密钥通过环境变量或密钥管理服务注入，不要写入仓库
