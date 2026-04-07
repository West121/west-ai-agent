# Docker Infra

当前目录提供的是本地开发和单机私有化演示用的基础依赖编排，不直接启动业务服务。

## Included Services

- `postgres`: PostgreSQL 16
- `redis`: Redis 7
- `minio`: 对象存储与控制台
- `opensearch`: 单节点 OpenSearch

业务服务 `platform-api`、`message-gateway`、`ai-service`、`worker-jobs` 仍由本地 `uv` 命令或上层脚本启动。

## Startup

在仓库根目录执行：

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

生产化基础设施编排使用：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d
```

停止并清理容器：

```bash
docker compose -f infra/docker/docker-compose.yml down
```

如果要连同命名卷数据一起清理：

```bash
docker compose -f infra/docker/docker-compose.yml down -v
```

## Ports

- PostgreSQL: `${POSTGRES_PORT:-5432}`
- Redis: `${REDIS_PORT:-6379}`
- MinIO API: `${MINIO_API_PORT:-9000}`
- MinIO Console: `${MINIO_CONSOLE_PORT:-9001}`
- OpenSearch API: `${OPENSEARCH_HTTP_PORT:-9200}`
- OpenSearch Metrics: `${OPENSEARCH_METRICS_PORT:-9600}`

## Required Environment Variables

可通过 shell 导出，或在仓库根目录准备 `.env`：

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `PLATFORM_DATA_ROOT`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_API_PORT`
- `MINIO_CONSOLE_PORT`
- `OPENSEARCH_INITIAL_ADMIN_PASSWORD`
- `OPENSEARCH_HTTP_PORT`
- `OPENSEARCH_METRICS_PORT`

根级参考文件见 [`.env.example`](/Users/west/dev/code/west/west-ai-agent/.env.example)。

## Data Persistence

Compose 默认会将数据落到仓库根目录下的：

- `data/postgres`
- `data/redis`
- `data/minio`
- `data/opensearch`

如果你只想重置依赖数据，删除这些目录后重新执行 `docker compose up -d` 即可。测试栈会把数据写到 `.tmp/e2e-stack/data`，不会污染默认目录。

## Validation

校验 compose 配置：

```bash
docker compose --env-file .env.example -f infra/docker/docker-compose.yml config
docker compose --env-file .env.example -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml config
```

查看容器状态：

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

快速探活示例：

```bash
curl http://127.0.0.1:9200
curl http://127.0.0.1:9001
```

## Deployment Notes

- 这个 compose 文件适合本地开发、联调和单机私有化演示
- 生产私有化部署建议把数据库、缓存、对象存储、搜索服务拆成独立运维单元
- OpenSearch 当前采用单节点配置和关闭安全插件的简化模式，不适合作为正式生产安全基线

## Backup & Restore

仓库根目录提供了配套脚本：

```bash
bash scripts/backup-platform-data.sh
bash scripts/restore-platform-data.sh /absolute/path/to/backup-dir
```

脚本会自动使用 `.env` 或 `.env.example` 中的 compose 变量。
