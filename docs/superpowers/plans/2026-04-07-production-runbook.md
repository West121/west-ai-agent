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

## 5. 业务服务启动顺序

1. 启动基础设施
2. 启动 `platform-api`
3. 启动 `message-gateway`
4. 启动 `ai-service`
5. 启动 `worker-jobs`
6. 启动 `admin-web` / `customer-h5`

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

## 8. 恢复

```bash
bash scripts/restore-platform-data.sh /absolute/path/to/backup-dir
```

## 9. 回滚

回滚按两层处理：

- 应用层：回滚镜像或 Git 提交
- 数据层：按备份目录执行恢复

## 10. 已知限制

- Android release 仍需要正式 keystore
- 生产环境暂未提供 Kubernetes manifests
- LangGraph 复杂流程未并入主问答链路
