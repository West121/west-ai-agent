import { expect, type Page } from '@playwright/test';

export const adminWebUrl = process.env.ADMIN_WEB_URL ?? 'http://127.0.0.1:43173';
export const customerH5Url = process.env.CUSTOMER_H5_URL ?? 'http://127.0.0.1:43174';

async function resolveAdminWebUrl() {
  const candidates = [
    process.env.ADMIN_WEB_URL,
    'http://127.0.0.1:4173',
    adminWebUrl,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/auth`, { method: 'GET' });
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return adminWebUrl;
}

export async function loginToAdmin(page: Page) {
  const reachableAdminWebUrl = await resolveAdminWebUrl();
  await page.goto(`${reachableAdminWebUrl}/auth`, { waitUntil: 'networkidle' });
  await page.locator('input[placeholder="admin"]').fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.getByRole('button', { name: '登录' }).click(),
  ]);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('企业管理后台')).toBeVisible();
  await expect(page.getByText(/admin · \d+ 权限/)).toBeVisible();
}

export async function openAdminNav(page: Page, label: string, heading: string) {
  await page.getByRole('link', { name: label, exact: true }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

export async function mockVideoBrowserApis(page: Page) {
  await page.addInitScript(() => {
    const createStream = () => new MediaStream();

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      stream: unknown;

      mimeType: string;

      state = 'inactive';

      ondataavailable: ((event: { data: Blob }) => void) | null = null;

      onstop: (() => void) | null = null;

      constructor(stream: unknown, options?: { mimeType?: string }) {
        this.stream = stream;
        this.mimeType = options?.mimeType ?? 'video/webm';
      }

      start() {
        this.state = 'recording';
        window.setTimeout(() => {
          this.ondataavailable?.({
            data: new Blob(['playwright-video-recording'], { type: this.mimeType }),
          });
        }, 20);
      }

      stop() {
        this.state = 'inactive';
        window.setTimeout(() => {
          this.onstop?.();
        }, 20);
      }
    }

    class MockRTCPeerConnection {
      localDescription: RTCSessionDescriptionInit | null = null;

      remoteDescription: RTCSessionDescriptionInit | null = null;

      onicecandidate: ((event: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null;

      ontrack: ((event: { streams: Array<ReturnType<typeof createStream>> }) => void) | null = null;

      private readonly senders: Array<{ track: { stop: () => void } }> = [];

      addTrack(track: { stop: () => void }) {
        const sender = { track };
        this.senders.push(sender);
        return sender;
      }

      getSenders() {
        return this.senders;
      }

      async createOffer() {
        return { type: 'offer', sdp: 'mock-offer-sdp' };
      }

      async createAnswer() {
        return { type: 'answer', sdp: 'mock-answer-sdp' };
      }

      async setLocalDescription(description: RTCSessionDescriptionInit) {
        this.localDescription = description;
      }

      async setRemoteDescription(description: RTCSessionDescriptionInit) {
        this.remoteDescription = description;
        if (this.ontrack) {
          this.ontrack({ streams: [createStream()] });
        }
      }

      async addIceCandidate() {
        return undefined;
      }

      close() {
        this.senders.forEach((sender) => sender.track.stop());
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => createStream(),
      },
    });

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    });

    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      value: MockRTCPeerConnection,
    });
  });
}
