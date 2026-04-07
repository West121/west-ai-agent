async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;

  if (text.trim()) {
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

function normalizeBaseUrl(value) {
  return String(value ?? '').replace(/\/+$/, '');
}

async function login(platformApiBaseUrl, username, password) {
  return requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
}

async function listKnowledgeDocuments(platformApiBaseUrl, accessToken) {
  return requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/knowledge/documents`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function importKnowledgeDocument(platformApiBaseUrl, accessToken, document) {
  return requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/knowledge/documents/import`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(document),
  });
}

async function publishAndRebuild(platformApiBaseUrl, accessToken, documentId, publishVersion = 1) {
  const document = await requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/knowledge/documents/${documentId}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (document.status === 'draft') {
    await requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/knowledge/documents/${documentId}/submit-review`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  if (document.status !== 'published') {
    const targetVersion = publishVersion ?? document.publish_version ?? document.version ?? 1;
    await requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/knowledge/documents/${documentId}/publish-version`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ publish_version: targetVersion }),
    });
  }
  return requestJson(`${normalizeBaseUrl(platformApiBaseUrl)}/knowledge/documents/${documentId}/rebuild-index`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function ensureKnowledgeDocumentsIndexed({
  platformApiBaseUrl,
  documents,
  username = process.env.RAG_EVAL_ADMIN_USERNAME ?? 'admin',
  password = process.env.RAG_EVAL_ADMIN_PASSWORD ?? 'admin123',
} = {}) {
  if (!platformApiBaseUrl) {
    throw new Error('platformApiBaseUrl is required');
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const loginResponse = await login(platformApiBaseUrl, username, password);
  const documentsResponse = await listKnowledgeDocuments(platformApiBaseUrl, loginResponse.access_token);
  const existingDocuments = Array.isArray(documentsResponse) ? documentsResponse : [];
  const results = [];

  for (const document of documents) {
    const normalizedTenantId = String(document.tenant_id ?? '').trim();
    const normalizedTitle = String(document.title ?? '').trim();
    if (!normalizedTenantId || !normalizedTitle) {
      continue;
    }

    const existing = existingDocuments.find(
      (item) => item.tenant_id === normalizedTenantId && item.title === normalizedTitle,
    );
    let documentId = existing?.id ?? null;

    if (!documentId) {
      const created = await importKnowledgeDocument(platformApiBaseUrl, loginResponse.access_token, document);
      documentId = created.id;
      results.push({ documentId, title: normalizedTitle, status: 'created' });
    } else {
      results.push({ documentId, title: normalizedTitle, status: existing.status });
    }

    if (!documentId) {
      continue;
    }

    const current = existing ?? (await listKnowledgeDocuments(platformApiBaseUrl, loginResponse.access_token)).find(
      (item) => item.id === documentId,
    );
    const publishVersion = current?.publish_version ?? current?.version ?? 1;
    await publishAndRebuild(platformApiBaseUrl, loginResponse.access_token, documentId, publishVersion);
  }

  return results;
}

export async function ensureRefundKnowledgeIndexed({
  platformApiBaseUrl,
  username = process.env.RAG_EVAL_ADMIN_USERNAME ?? 'admin',
  password = process.env.RAG_EVAL_ADMIN_PASSWORD ?? 'admin123',
} = {}) {
  const [result] = await ensureKnowledgeDocumentsIndexed({
    platformApiBaseUrl,
    username,
    password,
    documents: [
      {
        tenant_id: 'rag-eval',
        type: 'faq',
        title: '退款到账说明',
        category: '售后',
        tags: ['退款', '账期'],
        language: 'zh-CN',
        channels: ['web', 'h5', 'app'],
        content: 'Q: 退款多久到账？\nA: 一般情况下原路退款会在 1 到 3 个工作日到账。',
      },
    ],
  });

  if (!result) {
    return null;
  }

  return {
    documentId: result.documentId,
    taskId: `knowledge-${result.documentId}-v1`,
    indexedChunkCount: 1,
  };
}
