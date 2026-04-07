import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  average,
  delay,
  jsonHeaders,
  normalizeBaseUrl,
  percentile,
  requestJson,
  waitForEvent,
  writeJsonReport,
} from './test-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const platformApiBaseUrl = normalizeBaseUrl(process.env.PLATFORM_API_BASE_URL ?? 'http://127.0.0.1:8000');
const messageGatewayBaseUrl = normalizeBaseUrl(process.env.MESSAGE_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8010');
const messageGatewayWsUrl = normalizeBaseUrl(process.env.MESSAGE_GATEWAY_WS_URL ?? 'ws://127.0.0.1:8010/ws');
const aiServiceBaseUrl = normalizeBaseUrl(process.env.AI_SERVICE_BASE_URL ?? 'http://127.0.0.1:8020');

const totalConversations = Number(process.env.CUSTOMER_LOAD_CONVERSATIONS ?? 4);
const concurrency = Number(process.env.CUSTOMER_LOAD_CONCURRENCY ?? 2);
const rounds = Number(process.env.CUSTOMER_LOAD_ROUNDS ?? 4);
const withAi = String(process.env.CUSTOMER_LOAD_WITH_AI ?? 'true').toLowerCase() !== 'false';

async function createConversation(index) {
  const profile = await requestJson(`${platformApiBaseUrl}/public/customer/profiles`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      external_id: `load-user-${Date.now()}-${index}`,
      name: `压测用户 ${index}`,
      phone: `1390000${String(index).padStart(4, '0')}`,
      email: `load-${index}@example.com`,
    }),
  });

  const conversation = await requestJson(`${platformApiBaseUrl}/public/conversation/conversations`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      customer_profile_id: profile.id,
      channel: 'h5',
      assignee: `load-agent-${index}`,
      status: 'open',
    }),
  });

  return { profile, conversation };
}

async function runConversation(index) {
  let lastResult = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    lastResult = await runConversationOnce(index, attempt);
    if (lastResult.success) {
      return lastResult;
    }
    if (!lastResult.errors.some((error) => error.includes('timeout waiting for websocket event'))) {
      return lastResult;
    }
  }
  return lastResult;
}

async function runConversationOnce(index, attempt) {
  const messageLatencies = [];
  const aiLatencies = [];
  const errors = [];
  const { conversation } = await createConversation(index);
  const conversationId = String(conversation.id);
  const customerId = `load-customer-${index}-${attempt}-${Date.now()}`;
  const agentId = `load-agent-${index}-${attempt}-${Date.now()}`;
  const customerSocket = new WebSocket(`${messageGatewayWsUrl}/${conversationId}?client_id=${customerId}&role=customer`);
  const agentSocket = new WebSocket(`${messageGatewayWsUrl}/${conversationId}?client_id=${agentId}&role=agent`);

  try {
    await Promise.all([
      waitForEvent(customerSocket, (payload) => payload.type === 'connection.ack', 15000),
      waitForEvent(agentSocket, (payload) => payload.type === 'connection.ack', 15000),
    ]);

    for (let round = 0; round < rounds; round += 1) {
      const customerText = `压测消息 ${index}-${round} 退款多久到账？`;
      const startedAt = Date.now();
      customerSocket.send(JSON.stringify({ type: 'message.send', text: customerText }));

      const customerMessage = await waitForEvent(
        customerSocket,
        (payload) => payload.type === 'message.new' && payload.sender_id === customerId && payload.text === customerText,
        12000,
      );
      await waitForEvent(agentSocket, (payload) => payload.type === 'message.new' && payload.id === customerMessage.id, 12000);
      agentSocket.send(JSON.stringify({ type: 'message.ack', message_id: customerMessage.id }));
      await waitForEvent(
        customerSocket,
        (payload) => payload.type === 'message.ack' && payload.message_id === customerMessage.id && payload.status === 'read',
        12000,
      );
      messageLatencies.push(Date.now() - startedAt);

      if (withAi) {
        const aiStartedAt = Date.now();
        const decision = await requestJson(`${aiServiceBaseUrl}/chat/answer`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({ query: customerText }),
        });
        const aiAnswer = decision.answer ?? decision.clarification ?? '请转人工处理';
        const aiMessage = await requestJson(`${messageGatewayBaseUrl}/messages/${conversationId}`, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify({
            sender_id: `ai-bot-${index}`,
            sender_role: 'assistant',
            text: aiAnswer,
          }),
        });
        if (!aiMessage?.id) {
          throw new Error('ai message append did not return an id');
        }
        aiLatencies.push(Date.now() - aiStartedAt);
      }

      await delay(50);
    }

    await requestJson(`${platformApiBaseUrl}/public/conversation/conversations/${conversationId}/satisfaction`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ score: 5, comment: `load-test-${index}` }),
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    customerSocket.close();
    agentSocket.close();
  }

  return {
    conversationId,
    attempt,
    rounds,
    success: errors.length === 0,
    messageLatencies,
    aiLatencies,
    errors,
  };
}

async function main() {
  const startedAt = Date.now();
  const tasks = Array.from({ length: totalConversations }, (_, index) => () => runConversation(index + 1));
  const results = [];
  for (let index = 0; index < tasks.length; index += concurrency) {
    const batchResults = await Promise.all(tasks.slice(index, index + concurrency).map((task) => task()));
    results.push(...batchResults);
  }
  const allMessageLatencies = results.flatMap((item) => item.messageLatencies);
  const allAiLatencies = results.flatMap((item) => item.aiLatencies);
  const failed = results.filter((item) => !item.success);

  const summary = {
    conversations: results.length,
    successfulConversations: results.length - failed.length,
    failedConversations: failed.length,
    totalCustomerMessages: allMessageLatencies.length,
    totalAiMessages: allAiLatencies.length,
    avgMessageLatencyMs: Number(average(allMessageLatencies).toFixed(1)),
    p95MessageLatencyMs: Number(percentile(allMessageLatencies, 95).toFixed(1)),
    avgAiLatencyMs: Number(average(allAiLatencies).toFixed(1)),
    p95AiLatencyMs: Number(percentile(allAiLatencies, 95).toFixed(1)),
    wallClockMs: Date.now() - startedAt,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    config: { totalConversations, concurrency, rounds, withAi },
    summary,
    results,
  };
  const reportPath = await writeJsonReport(rootDir, 'customer-load-report.json', report);
  console.log(JSON.stringify({ reportPath, summary }, null, 2));

  if (failed.length > 0) {
    console.error(`CUSTOMER_LOAD_FAILED: ${failed.map((item) => item.conversationId).join(', ')}`);
    process.exit(1);
  }

  console.log('CUSTOMER_LOAD_OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
