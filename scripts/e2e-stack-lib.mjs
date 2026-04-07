import { execFileSync, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(rootDir, '.tmp', 'e2e-stack');
const logDir = path.join(runtimeDir, 'logs');
const metaFile = path.join(runtimeDir, 'meta.json');
const composeFile = path.join(rootDir, 'infra', 'docker', 'docker-compose.yml');

function envInt(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getStackConfig() {
  const postgresPort = envInt('E2E_POSTGRES_PORT', 25432);
  const redisPort = envInt('E2E_REDIS_PORT', 26379);
  const minioApiPort = envInt('E2E_MINIO_API_PORT', 29000);
  const minioConsolePort = envInt('E2E_MINIO_CONSOLE_PORT', 29001);
  const opensearchHttpPort = envInt('E2E_OPENSEARCH_HTTP_PORT', 29200);
  const opensearchMetricsPort = envInt('E2E_OPENSEARCH_METRICS_PORT', 29600);
  const platformApiPort = envInt('E2E_PLATFORM_API_PORT', 28000);
  const messageGatewayPort = envInt('E2E_MESSAGE_GATEWAY_PORT', 28010);
  const aiServicePort = envInt('E2E_AI_SERVICE_PORT', 28020);
  const adminWebPort = envInt('E2E_ADMIN_WEB_PORT', 48173);
  const customerH5Port = envInt('E2E_CUSTOMER_H5_PORT', 48174);
  const dataRoot = path.join(runtimeDir, 'data');

  return {
    rootDir,
    composeFile,
    dataRoot,
    postgresPort,
    redisPort,
    minioApiPort,
    minioConsolePort,
    opensearchHttpPort,
    opensearchMetricsPort,
    platformApiPort,
    messageGatewayPort,
    aiServicePort,
    adminWebPort,
    customerH5Port,
    urls: {
      platformApi: `http://127.0.0.1:${platformApiPort}`,
      messageGateway: `http://127.0.0.1:${messageGatewayPort}`,
      messageGatewayWs: `ws://127.0.0.1:${messageGatewayPort}/ws`,
      aiService: `http://127.0.0.1:${aiServicePort}`,
      adminWeb: `http://127.0.0.1:${adminWebPort}`,
      customerH5: `http://127.0.0.1:${customerH5Port}`,
    },
  };
}

function serviceDefinitions(config) {
  const openAiLikeApiKey =
    process.env.AI_SERVICE_OPENAI_LIKE_API_KEY ?? process.env.QWEN_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  const defaultProvider = process.env.AI_SERVICE_DEFAULT_PROVIDER ?? 'openai_like';
  const openAiLikeBaseUrl =
    process.env.AI_SERVICE_OPENAI_LIKE_BASE_URL ??
    (process.env.QWEN_API_KEY ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' : '');
  const postgresUrl =
    process.env.APP_DATABASE_URL ?? `postgresql+psycopg://postgres:postgres@127.0.0.1:${config.postgresPort}/platform`;
  const opensearchUrl = process.env.AI_SERVICE_OPENSEARCH_URL ?? `http://127.0.0.1:${config.opensearchHttpPort}`;
  const opensearchIndex = process.env.AI_SERVICE_OPENSEARCH_INDEX ?? 'knowledge_chunks';

  return [
    {
      name: 'platform-api',
      cwd: path.join(rootDir, 'services', 'platform-api'),
      command: 'uv',
      args: ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(config.platformApiPort)],
      env: {
        APP_DATABASE_URL: postgresUrl,
        WORKER_JOBS_SEARCH_INDEX_PROVIDER: 'opensearch',
        WORKER_JOBS_OPENSEARCH_URL: opensearchUrl,
        WORKER_JOBS_OPENSEARCH_INDEX: opensearchIndex,
        WORKER_JOBS_OBJECT_STORAGE_PROVIDER: 'noop',
      },
      readyUrl: `${config.urls.platformApi}/healthz`,
    },
    {
      name: 'message-gateway',
      cwd: path.join(rootDir, 'services', 'message-gateway'),
      command: 'uv',
      args: ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(config.messageGatewayPort)],
      env: {},
      readyUrl: `${config.urls.messageGateway}/healthz`,
    },
    {
      name: 'ai-service',
      cwd: path.join(rootDir, 'services', 'ai-service'),
      command: 'uv',
      args: ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(config.aiServicePort)],
      env: {
        AI_SERVICE_DEFAULT_PROVIDER: defaultProvider,
        AI_SERVICE_OPENAI_LIKE_BASE_URL: openAiLikeBaseUrl,
        AI_SERVICE_OPENAI_LIKE_API_KEY: openAiLikeApiKey,
        AI_SERVICE_OPENSEARCH_URL: opensearchUrl,
        AI_SERVICE_OPENSEARCH_INDEX: opensearchIndex,
      },
      readyUrl: `${config.urls.aiService}/healthz`,
    },
    {
      name: 'admin-web',
      cwd: path.join(rootDir, 'apps', 'admin-web'),
      command: 'pnpm',
      args: ['dev', '--host', '127.0.0.1', '--port', String(config.adminWebPort), '--strictPort'],
      env: {
        VITE_PLATFORM_API_BASE_URL: config.urls.platformApi,
      },
      readyUrl: `${config.urls.adminWeb}/auth`,
    },
    {
      name: 'customer-h5',
      cwd: path.join(rootDir, 'apps', 'customer-h5'),
      command: 'pnpm',
      args: ['dev', '--host', '127.0.0.1', '--port', String(config.customerH5Port), '--strictPort'],
      env: {
        VITE_PLATFORM_API_BASE_URL: config.urls.platformApi,
        VITE_MESSAGE_GATEWAY_WS_URL: config.urls.messageGatewayWs,
        VITE_AI_SERVICE_BASE_URL: config.urls.aiService,
      },
      readyUrl: `${config.urls.customerH5}/standalone`,
    },
  ];
}

async function ensureRuntimeDir() {
  await fs.mkdir(logDir, { recursive: true });
}

function composeEnv(config) {
  return {
    COMPOSE_PROJECT_NAME: 'leka-e2e',
    PLATFORM_DATA_ROOT: config.dataRoot,
    POSTGRES_PORT: String(config.postgresPort),
    REDIS_PORT: String(config.redisPort),
    MINIO_API_PORT: String(config.minioApiPort),
    MINIO_CONSOLE_PORT: String(config.minioConsolePort),
    OPENSEARCH_HTTP_PORT: String(config.opensearchHttpPort),
    OPENSEARCH_METRICS_PORT: String(config.opensearchMetricsPort),
  };
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findListeningPids(port, host = '127.0.0.1') {
  try {
    const output = execFileSync('lsof', ['-tiTCP:' + String(port), '-sTCP:LISTEN', '-nP'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => Number(line))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

function managedPorts(config) {
  return [
    config.platformApiPort,
    config.messageGatewayPort,
    config.aiServicePort,
    config.adminWebPort,
    config.customerH5Port,
  ];
}

async function freeManagedPorts(config) {
  for (const port of managedPorts(config)) {
    for (const pid of findListeningPids(port)) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  for (const port of managedPorts(config)) {
    for (const pid of findListeningPids(port)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? rootDir,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

function spawnDetached(definition) {
  const logPath = path.join(logDir, `${definition.name}.log`);
  const child = spawn(definition.command, definition.args, {
    cwd: definition.cwd,
    env: { ...process.env, ...definition.env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const append = async (chunk) => {
    await fs.appendFile(logPath, chunk);
  };

  child.stdout?.on('data', (chunk) => {
    void append(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    void append(chunk);
  });
  child.unref();
  return { pid: child.pid, logPath };
}

async function waitForUrl(url, timeoutMs = 90_000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
      lastError = new Error(`${url} responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function waitForTcpPort(port, host = '127.0.0.1', timeoutMs = 90_000) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });
        socket.once('connect', () => {
          socket.end();
          resolve(undefined);
        });
        socket.once('error', (error) => {
          socket.destroy();
          reject(error);
        });
      });
      return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for tcp://${host}:${port}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function loadMeta() {
  if (!(await fileExists(metaFile))) {
    return null;
  }
  const raw = await fs.readFile(metaFile, 'utf8');
  return JSON.parse(raw);
}

async function saveMeta(meta) {
  await fs.writeFile(metaFile, JSON.stringify(meta, null, 2));
}

export async function stopE2EStack(options = {}) {
  const config = getStackConfig();
  const meta = await loadMeta();
  if (meta?.processes) {
    for (const processMeta of meta.processes.reverse()) {
      if (!processMeta.pid || !isPidAlive(processMeta.pid)) {
        continue;
      }
      try {
        process.kill(processMeta.pid, 'SIGTERM');
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (const processMeta of meta.processes.reverse()) {
      if (!processMeta.pid || !isPidAlive(processMeta.pid)) {
        continue;
      }
      try {
        process.kill(processMeta.pid, 'SIGKILL');
      } catch {}
    }
  }

  if (options.keepCompose !== true) {
    await run('docker', ['compose', '-f', composeFile, 'down'], {
      cwd: rootDir,
      env: composeEnv(config),
    });
  }

  await freeManagedPorts(config);

  if (await fileExists(metaFile)) {
    await fs.unlink(metaFile);
  }
}

export async function startE2EStack() {
  const config = getStackConfig();
  await ensureRuntimeDir();
  await stopE2EStack({ keepCompose: false }).catch(() => {});
  await run('docker', ['compose', '-f', composeFile, 'up', '-d'], {
    cwd: rootDir,
    env: composeEnv(config),
  });
  await waitForTcpPort(config.postgresPort);
  await waitForTcpPort(config.redisPort);
  await waitForUrl(`http://127.0.0.1:${config.minioApiPort}/minio/health/live`);
  await waitForUrl(`http://127.0.0.1:${config.opensearchHttpPort}`);

  const processes = [];
  for (const definition of serviceDefinitions(config)) {
    const spawned = spawnDetached(definition);
    processes.push({
      name: definition.name,
      pid: spawned.pid,
      logPath: spawned.logPath,
      readyUrl: definition.readyUrl,
    });
    await waitForUrl(definition.readyUrl);
  }

  const meta = {
    startedAt: new Date().toISOString(),
    config,
    processes,
  };
  await saveMeta(meta);
  return meta;
}
