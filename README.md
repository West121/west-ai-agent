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

环境分层建议：

- `.env.example`：仓库默认参考值，只用于说明和本地复制
- `.env`：本机开发和联调用的私有覆盖文件
- Shell 导出变量：一次性验证或临时运行时覆盖
- CI / 密钥管理服务：生产私有化部署的最终注入层

生产环境建议：

- `APP_ENV=production`
- `APP_JWT_SECRET` 必须替换默认值
- `APP_BOOTSTRAP_DEFAULT_ADMIN=false`
- `APP_BOOTSTRAP_SAMPLE_DATA=false`

如果你希望根级脚本读取当前 shell 变量，先在仓库根目录执行：

```bash
cp .env.example .env
set -a
source .env
set +a
```

单机私有化部署建议使用：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build
```

## Production Deployment

当前仓库把基础设施和业务服务分开管理：

- `infra/docker/docker-compose.yml` 和 `infra/docker/docker-compose.prod.yml` 负责 PostgreSQL、Redis、MinIO、OpenSearch
- `apps/admin-web`、`apps/customer-h5`、`services/platform-api`、`services/message-gateway`、`services/ai-service`、`services/worker-jobs` 现在都提供了对应 Dockerfile，可直接纳入 CI 或镜像流水线

镜像构建口径建议：

- Web 前端先执行 `pnpm --filter admin-web build`
- H5 前端先执行 `pnpm --filter customer-h5 build`
- Python 服务先执行各自 pytest / smoke，再交给组织内标准 Python 镜像模板打包
- Flutter 作为独立移动端交付，不和后端同镜像发布

首次初始化建议：

1. `cp .env.example .env`
2. 填好生产密钥、域名、数据库和对象存储参数
3. 启动基础设施
4. 首次启动 `platform-api` 时保留 `APP_BOOTSTRAP_DEFAULT_ADMIN=true` 与 `APP_BOOTSTRAP_SAMPLE_DATA=true`
5. 确认默认管理员和基础样例数据已创建后，把两个 bootstrap 开关改回 `false`
6. 再启动 `message-gateway`、`ai-service`、`admin-web`、`customer-h5`
7. 需要执行批处理索引任务时，再按需运行 `worker-jobs`

`worker-jobs` 的知识对象存储在首次写入时会自动创建 MinIO bucket；如果你希望提前预置 bucket，也可以在 MinIO Console 里手工创建。

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

- PostgreSQL: `127.0.0.1:15432`
- Redis: `127.0.0.1:16379`
- MinIO API: `127.0.0.1:19000`
- MinIO Console: `127.0.0.1:19001`
- OpenSearch: `127.0.0.1:19200`

更多说明见 [infra/docker/README.md](/Users/west/dev/code/west/west-ai-agent/infra/docker/README.md)。

如果要用私有化交付版基础设施编排：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d
```

如果要连同业务服务一起拉起单机私有化编排：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml -f infra/docker/docker-compose.apps.yml up -d
```

### 2. Start frontend apps

```bash
pnpm dev:admin
pnpm dev:h5
```

### 3. Start Python services

分别在对应目录执行：

```bash
cd services/platform-api && uv run uvicorn app.main:app --host 127.0.0.1 --port 18000
cd services/message-gateway && uv run uvicorn app.main:app --host 127.0.0.1 --port 18010
cd services/ai-service && uv run uvicorn app.main:app --host 127.0.0.1 --port 18020
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

测试栈默认使用独立端口，不会占用本机常驻的 `15432/16379/19000/19200`。

如果服务已经在本机运行，也可以只执行在线烟测：

```bash
pnpm test:smoke:local
```

### Advanced AI / customer-service verification

RAG 评测会自动：

- 启动隔离测试栈
- 导入中文客服知识文档
- 提审、发布并重建索引
- 调用 `ai-service` 的真实决策接口
- 输出 JSON 报告到 [/.tmp/reports/rag-eval-report.json](/Users/west/dev/code/west/west-ai-agent/.tmp/reports/rag-eval-report.json)

```bash
pnpm test:rag-eval
```

如果服务已经在本机运行，也可以只执行在线评测：

```bash
pnpm test:rag-eval:local
```

客服长会话/并发压测会自动：

- 启动隔离测试栈
- 创建多个访客与会话
- 通过 `message-gateway` 发送消息并验证 `message.ack`
- 调用 `ai-service` 生成机器人回复
- 输出吞吐和延迟报告到 [/.tmp/reports/customer-load-report.json](/Users/west/dev/code/west/west-ai-agent/.tmp/reports/customer-load-report.json)

```bash
pnpm test:customer-load
```

默认会跑 `4` 个会话、并发 `2` 个房间、每个会话 `4` 轮消息。可通过环境变量覆盖：

```bash
CUSTOMER_LOAD_CONVERSATIONS=8 CUSTOMER_LOAD_CONCURRENCY=4 CUSTOMER_LOAD_ROUNDS=6 pnpm test:customer-load
```

辅助单测：

```bash
node --test tests/evals/rag-eval-lib.test.mjs tests/evals/customer-load-lib.test.mjs
```

### RAG evaluation and customer load

```bash
pnpm test:rag-eval
pnpm test:customer-load
```

`test:rag-eval` 会先用本地 `platform-api` 重新索引播种的退款知识，再调用 `ai-service` 的 `decision` 和 `chat/answer` 接口做评测，输出命中、决策和延迟摘要。

`test:customer-load` 会创建多会话并发压测，走 `platform-api` 创建客户和会话，`message-gateway` 做双端 WebSocket 收发与 `message.ack`，并调用 `ai-service` 做每轮决策与必要回复写回。可以通过 `--concurrency`、`--report`、`--platform-api`、`--message-gateway`、`--message-gateway-ws`、`--ai-service` 调整压测规模和目标服务。

对应样本数据分别位于 [tests/fixtures/rag-eval-cases.json](/Users/west/dev/code/west/west-ai-agent/tests/fixtures/rag-eval-cases.json) 和 [tests/fixtures/customer-load-scenarios.json](/Users/west/dev/code/west/west-ai-agent/tests/fixtures/customer-load-scenarios.json)。

如果你只想跑纯评分逻辑，可以用：

```bash
pnpm test:rag-eval:unit
pnpm test:customer-load:unit
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

备份内容包括：

- PostgreSQL 导出 SQL
- `data/postgres`
- `data/redis`
- `data/minio`
- `data/opensearch`

恢复时会先停止基础设施，再回填数据目录并重新导入数据库。

## Private Deployment Notes

- `infra/docker/docker-compose.yml` 当前承载的是本地开发和单机私有化基础依赖，不包含业务服务镜像编排
- `infra/docker/docker-compose.apps.yml` 提供业务服务镜像编排，适合单机私有化交付或验收环境
- 私有化部署时建议：
  - 先将 PostgreSQL、Redis、MinIO、OpenSearch 作为基础设施独立部署
  - 再为 `platform-api`、`message-gateway`、`ai-service`、`worker-jobs` 分别准备镜像和运行配置
  - 将模型密钥和业务密钥通过环境变量或密钥管理服务注入，不要写入仓库
  - 业务服务镜像由组织内 CI 产出，本仓库当前只提供源码、脚本与部署口径，不包含 Dockerfile

更细的生产部署步骤见：
- [2026-04-07-production-runbook.md](/Users/west/dev/code/west/west-ai-agent/docs/superpowers/plans/2026-04-07-production-runbook.md)
- [2026-04-07-acceptance-test-report.md](/Users/west/dev/code/west/west-ai-agent/docs/superpowers/plans/2026-04-07-acceptance-test-report.md)
