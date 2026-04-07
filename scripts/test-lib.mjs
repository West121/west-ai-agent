import { promises as fs } from 'node:fs';
import path from 'node:path';

export function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export function jsonHeaders(accessToken) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

export async function loginAdmin(platformApiBaseUrl) {
  const login = await requestJson(`${platformApiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      username: process.env.TEST_ADMIN_USERNAME ?? 'admin',
      password: process.env.TEST_ADMIN_PASSWORD ?? 'admin123',
    }),
  });
  return login.access_token;
}

export async function ensureReportDir(rootDir) {
  const reportDir = path.join(rootDir, '.tmp', 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  return reportDir;
}

export async function writeJsonReport(rootDir, filename, payload) {
  const reportDir = await ensureReportDir(rootDir);
  const reportPath = path.join(reportDir, filename);
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2));
  return reportPath;
}

export function percentile(values, target) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((target / 100) * sorted.length) - 1));
  return sorted[index];
}

export function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForEvent(socket, predicate, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('timeout waiting for websocket event'));
    }, timeoutMs);

    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!predicate(payload)) {
          return;
        }
        cleanup();
        resolve(payload);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error('websocket error'));
    };

    const onClose = () => {
      cleanup();
      reject(new Error('websocket closed'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
    };

    socket.addEventListener('message', onMessage);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}
