# Docker Infra

当前目录提供的是本地开发和单机私有化演示用的基础依赖编排，以及可选的业务服务生产化编排。

## Included Services

- `postgres`: PostgreSQL 16
- `redis`: Redis 7
- `minio`: 对象存储与控制台
- `opensearch`: 单节点 OpenSearch

`platform-api`、`message-gateway`、`ai-service`、`worker-jobs`、`admin-web`、`customer-h5` 的 Docker 镜像和生产编排见 `docker-compose.prod.yml`。

## Startup

在仓库根目录执行：

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

生产化基础设施编排使用：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d
```

如果要同时构建业务服务镜像：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml up -d --build
```

建议的环境分层顺序：

- `.env.example`：仓库参考值
- `.env`：本地联调覆盖
- 生产环境变量：由 CI、K8s Secret 或部署平台注入

首次初始化时，建议先完成：

1. 启动基础设施
2. 让 `platform-api` 首次创建默认管理员与样例数据
3. 再启动 `message-gateway`、`ai-service`、`admin-web`、`customer-h5`
4. `worker-jobs` 作为一次性任务镜像，在需要导入/索引时手工运行

`worker-jobs` 的对象存储 sink 会在第一次写入时自动创建所需 MinIO bucket；如果你希望提前创建，也可以直接在 MinIO Console 操作。

`worker-jobs` 的批处理示例：

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml --profile jobs run --rm worker-jobs --job knowledge-index --input /jobs/input.json
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

- PostgreSQL: `${POSTGRES_PORT:-15432}`
- Redis: `${REDIS_PORT:-16379}`
- MinIO API: `${MINIO_API_PORT:-19000}`
- MinIO Console: `${MINIO_CONSOLE_PORT:-19001}`
- OpenSearch API: `${OPENSEARCH_HTTP_PORT:-19200}`
- OpenSearch Metrics: `${OPENSEARCH_METRICS_PORT:-19600}`

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

如果生产环境由 CI 平台管理密钥，上述变量可以不写进文件，但仍要保证最终注入值与这里的语义一致。

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
curl http://127.0.0.1:19200
curl http://127.0.0.1:19001
```

## Deployment Notes

- 这个 compose 文件适合本地开发、联调和单机私有化演示
- 生产私有化部署建议把数据库、缓存、对象存储、搜索服务拆成独立运维单元，并用这里的业务服务镜像承载应用层
- OpenSearch 当前采用单节点配置和关闭安全插件的简化模式，不适合作为正式生产安全基线

## Backup & Restore

仓库根目录提供了配套脚本：

```bash
bash scripts/backup-platform-data.sh
bash scripts/restore-platform-data.sh /absolute/path/to/backup-dir
```

脚本会自动使用 `.env` 或 `.env.example` 中的 compose 变量。
