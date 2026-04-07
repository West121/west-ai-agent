# Production Runbook

## 1. 目标

这份 Runbook 用于把当前企业级智能客服平台从本地开发态提升到可交付的私有化部署态，覆盖：

- 基础设施依赖
- 业务服务启动顺序
- 环境变量
- 备份恢复
- 发布与回滚

## 2. 环境要求

- Docker / Docker Compose
- Node.js + pnpm
- Python + uv
- Flutter 仅在需要移动端构建时使用

## 3. 基础设施

推荐优先独立部署：

- PostgreSQL
- Redis
- MinIO
- OpenSearch

单机演示和轻量私有化可使用：

```bash
cp .env.example .env
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d
```

## 3.1 镜像构建

当前仓库把业务源码、测试和部署口径保留在一起，但没有随仓库提供业务服务 Dockerfile。正式交付时建议由 CI 或镜像流水线完成以下工作：

- `admin-web`：执行 `pnpm --filter admin-web build`，将 `dist/` 作为前端镜像内容
- `customer-h5`：执行 `pnpm --filter customer-h5 build`，将 `dist/` 作为 H5 镜像内容
- `platform-api`、`message-gateway`、`ai-service`、`worker-jobs`：先通过各自测试，再用组织内统一 Python 基础镜像打包
- `apps/mobile-flutter`：单独走 Flutter 构建和签名流程，不和后端镜像混发

如果你的部署平台支持 Helm / Kustomize / Compose 镜像引用，建议把业务镜像标签和环境变量分开管理，避免把构建产物和运行配置耦在一起。

## 4. 关键环境变量

必须调整：

- `APP_ENV=production`
- `APP_JWT_SECRET=<strong-secret>`
- `APP_BOOTSTRAP_DEFAULT_ADMIN=false`
- `APP_BOOTSTRAP_SAMPLE_DATA=false`
- `AI_SERVICE_OPENAI_LIKE_API_KEY=<qwen-or-compatible-key>`
- `MINIO_ROOT_PASSWORD=<strong-password>`
- `OPENSEARCH_INITIAL_ADMIN_PASSWORD=<strong-password>`

建议按服务拆分：

- `platform-api`
- `message-gateway`
- `ai-service`
- `worker-jobs`

环境分层建议：

1. 仓库默认：`.env.example`
2. 本地联调：`.env`
3. 生产私有化：CI / Secret Manager / 部署平台环境变量

生产环境不建议把以下值留在仓库或默认值中：

- `APP_JWT_SECRET`
- `APP_DEFAULT_ADMIN_PASSWORD`
- `AI_SERVICE_OPENAI_LIKE_API_KEY`
- `MINIO_ROOT_PASSWORD`
- `OPENSEARCH_INITIAL_ADMIN_PASSWORD`

## 5. 业务服务启动顺序

1. 启动基础设施
2. 启动 `platform-api`
3. 启动 `message-gateway`
4. 启动 `ai-service`
5. 启动 `worker-jobs`
6. 启动 `admin-web` / `customer-h5`

首次初始化时建议：

1. 先保留 `APP_BOOTSTRAP_DEFAULT_ADMIN=true` 和 `APP_BOOTSTRAP_SAMPLE_DATA=true`
2. 启动 `platform-api`，让它创建默认管理员、权限和样例业务数据
3. 启动 `worker-jobs`，它会在第一次处理知识任务时自动准备 MinIO bucket
4. 验证默认账号可登录后，把两个 bootstrap 开关改回 `false`
5. 重新启动 `platform-api`，让后续运行进入生产态

如果你已经有独立 IAM / SSO，则默认管理员只建议保留为应急恢复账号。

## 6. 上线前检查

- `pnpm verify`
- `pnpm test:e2e`
- `pnpm test:smoke`
- `pnpm test:mobile-flutter`
- `pnpm mobile:android:doctor`

## 7. 备份

```bash
bash scripts/backup-platform-data.sh
```

输出目录默认在 `backups/<timestamp>`。

备份内容包含：

- PostgreSQL 的 SQL 导出
- `data/postgres`
- `data/redis`
- `data/minio`
- `data/opensearch`

如果仓库根目录存在 `.env`，脚本优先读取 `.env`；否则回退到 `.env.example`。

## 8. 恢复

```bash
bash scripts/restore-platform-data.sh /absolute/path/to/backup-dir
```

恢复前建议先确认：

- 目标环境的 `.env` 或等价环境变量已经准备好
- 目标数据库为空，或者你已经接受覆盖现有数据
- 对象存储和搜索服务可以重建数据目录

## 9. 回滚

回滚按两层处理：

- 应用层：回滚镜像或 Git 提交
- 数据层：按备份目录执行恢复

## 10. 已知限制

- 业务服务镜像不随仓库发布，正式部署需要你自己的 CI / 镜像仓库流水线
- Android release 仍需要正式 keystore
- 生产环境暂未提供 Kubernetes manifests
- OpenSearch 本地/单机编排使用的是简化模式，不是完整生产安全基线
- LangGraph 复杂流程未并入主问答链路
- 视频客服目前是最小闭环，不是完整 WebRTC / 信令系统
