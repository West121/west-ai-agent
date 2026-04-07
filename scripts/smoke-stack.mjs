const platformApiBaseUrl = normalizeBaseUrl(process.env.PLATFORM_API_BASE_URL ?? 'http://127.0.0.1:8000');
const messageGatewayBaseUrl = normalizeBaseUrl(process.env.MESSAGE_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8010');
const messageGatewayWsUrl = normalizeBaseUrl(process.env.MESSAGE_GATEWAY_WS_URL ?? 'ws://127.0.0.1:8010/ws');
const aiServiceBaseUrl = normalizeBaseUrl(process.env.AI_SERVICE_BASE_URL ?? 'http://127.0.0.1:8020');

async function main() {
  const login = await requestJson(`${platformApiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123',
    }),
  });

  const authHeaders = jsonHeaders(login.access_token);
  const [users, tickets, leaveMessages, history, providers] = await Promise.all([
    requestJson(`${platformApiBaseUrl}/auth/users`, { headers: authHeaders }),
    requestJson(`${platformApiBaseUrl}/service/tickets`, { headers: authHeaders }),
    requestJson(`${platformApiBaseUrl}/service/leave-messages`, { headers: authHeaders }),
    requestJson(`${platformApiBaseUrl}/conversation/conversations/history`, { headers: authHeaders }),
    requestJson(`${aiServiceBaseUrl}/providers`, {}),
  ]);

  const authUsers = Array.isArray(users) ? users : users.items;

  if (!Array.isArray(authUsers) || authUsers.length === 0) {
    throw new Error('auth/users returned empty payload');
  }
  if (!Array.isArray(tickets.items) || !Array.isArray(leaveMessages.items) || !Array.isArray(history.items)) {
    throw new Error('platform service payload shape is invalid');
  }
  if (!Array.isArray(providers.providers) || providers.providers.length === 0) {
    throw new Error('ai-service providers payload is invalid');
  }

  const conversation = history.items[0];
  if (!conversation) {
    throw new Error('no conversation available for smoke test');
  }

  const summary = await requestJson(
    `${platformApiBaseUrl}/conversation/conversations/${conversation.id}/summary`,
    { headers: authHeaders },
  );

  if (!('conversation_id' in summary)) {
    throw new Error('summary payload is invalid');
  }

  const aiCompletion = await requestJson(`${aiServiceBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: '请总结这次烟测通过' }],
    }),
  });

  if (!aiCompletion.provider || !Array.isArray(aiCompletion.choices)) {
    throw new Error('ai completion payload is invalid');
  }

  const conversationId = String(conversation.id);
  const customerId = `smoke-customer-${Date.now()}`;
  const agentId = `smoke-agent-${Date.now()}`;
  const customerSocket = new WebSocket(`${messageGatewayWsUrl}/${conversationId}?client_id=${customerId}&role=customer`);
  const agentSocket = new WebSocket(`${messageGatewayWsUrl}/${conversationId}?client_id=${agentId}&role=agent`);

  try {
    await Promise.all([
      waitForEvent(customerSocket, (payload) => payload.type === 'connection.ack'),
      waitForEvent(agentSocket, (payload) => payload.type === 'connection.ack'),
    ]);

    customerSocket.send(JSON.stringify({ type: 'message.send', text: 'smoke test message' }));
    const customerMessage = await waitForEvent(
      customerSocket,
      (payload) => payload.type === 'message.new' && payload.sender_id === customerId,
    );
    await waitForEvent(
      agentSocket,
      (payload) => payload.type === 'message.new' && payload.id === customerMessage.id,
    );

    agentSocket.send(JSON.stringify({ type: 'message.ack', message_id: customerMessage.id }));
    const ack = await waitForEvent(
      customerSocket,
      (payload) => payload.type === 'message.ack' && payload.message_id === customerMessage.id,
    );

    if (ack.status !== 'read') {
      throw new Error(`unexpected ack status: ${ack.status}`);
    }
  } finally {
    customerSocket.close();
    agentSocket.close();
  }

  const messageHistory = await requestJson(`${messageGatewayBaseUrl}/messages/${conversationId}`, {});
  if (!Array.isArray(messageHistory.items) || messageHistory.items.length === 0) {
    throw new Error('message history is empty after websocket send');
  }

  console.log('SMOKE_OK');
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function jsonHeaders(accessToken) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload;

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

function waitForEvent(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('timeout waiting for websocket event'));
    }, 5000);

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
