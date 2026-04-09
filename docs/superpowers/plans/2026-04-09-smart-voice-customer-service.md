# Smart Voice Customer Service Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully local/private realtime AI voice customer service flow on top of the existing text客服 platform.

**Architecture:** Add a new `voice-realtime-service` that owns realtime audio orchestration, partial/final transcript handling, TTS playback coordination, and handoff state transitions. Reuse the existing `ai-service` for RAG and complex workflow decisions, `message-gateway` for message/event fanout, and `platform-api` for persistence and audit.

**Tech Stack:** LiveKit, FastAPI, sherpa-onnx, FunASR, React/Vite, existing message-gateway/platform-api/ai-service, pytest, Vitest, Playwright.

---

## Chunk 1: File map

### Task 1: Define new and modified files

**Files:**
- Create: `services/voice-realtime-service/app/...`
- Create: `services/voice-realtime-service/tests/...`
- Modify: `infra/docker/docker-compose.yml`
- Modify: `infra/docker/docker-compose.prod.yml`
- Modify: `apps/customer-h5/src/components/chat-workspace.tsx`
- Modify: `apps/customer-h5/src/lib/runtime-config.ts`
- Modify: `apps/customer-h5/src/hooks/use-message-gateway.ts`
- Modify: `apps/admin-web/src/routes/conversations.tsx`
- Modify: `apps/admin-web/src/lib/runtime-config.ts`
- Modify: `services/platform-api/app/api/router.py`
- Modify: `services/platform-api/app/core/db.py`
- Modify: `services/platform-api/app/main.py`
- Create: `services/platform-api/app/modules/voice/...`
- Modify: `services/message-gateway/app/ws/router.py`
- Modify: `services/ai-service/app/api/router.py`

- [ ] **Step 1: Review current message, AI, and video boundaries**

Read:
- `services/message-gateway/app/ws/router.py`
- `services/ai-service/app/api/router.py`
- `services/platform-api/app/modules/video/*`
- `apps/customer-h5/src/components/chat-workspace.tsx`

Expected: Clear ownership map for realtime voice additions.

- [ ] **Step 2: Document file responsibilities in the design doc if missing**

Update:
- `docs/plans/2026-04-09-smart-voice-customer-service-design.md`

Expected: Every new file has one clear responsibility.

- [ ] **Step 3: Commit planning-only clarification if the repo requires it**

```bash
git add docs/plans/2026-04-09-smart-voice-customer-service-design.md docs/superpowers/plans/2026-04-09-smart-voice-customer-service.md
git commit -m "docs: add smart voice customer service design and plan"
```

## Chunk 2: Platform persistence and APIs

### Task 2: Add voice persistence module to platform-api

**Files:**
- Create: `services/platform-api/app/modules/voice/models.py`
- Create: `services/platform-api/app/modules/voice/schemas.py`
- Create: `services/platform-api/app/modules/voice/crud.py`
- Create: `services/platform-api/app/modules/voice/router.py`
- Modify: `services/platform-api/app/api/router.py`
- Modify: `services/platform-api/app/core/db.py`
- Test: `services/platform-api/tests/modules/voice/test_voice_module.py`

- [ ] **Step 1: Write failing persistence/API tests**

Test scenarios:
- create voice session
- append partial transcript
- finalize transcript
- create handoff record
- list session transcripts

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/platform-api && uv run pytest tests/modules/voice/test_voice_module.py -v
```

Expected: FAIL because module does not exist yet.

- [ ] **Step 2: Implement SQLAlchemy models and schemas**

Add:
- `VoiceSession`
- `VoiceTranscriptSegment`
- `VoiceAudioAsset`
- `VoiceHandoffRecord`

- [ ] **Step 3: Implement CRUD and router**

Endpoints:
- `POST /voice/sessions`
- `POST /voice/sessions/{id}/transcripts`
- `GET /voice/sessions/{id}/transcripts`
- `POST /voice/sessions/{id}/handoff`
- `GET /voice/sessions/{id}`

- [ ] **Step 4: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/platform-api && uv run pytest tests/modules/voice/test_voice_module.py -v
```

Expected: PASS

- [ ] **Step 5: Run platform-api regression**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/platform-api && uv run pytest -q
```

Expected: Existing tests still pass.

## Chunk 3: voice-realtime-service skeleton

### Task 3: Create voice-realtime-service

**Files:**
- Create: `services/voice-realtime-service/pyproject.toml`
- Create: `services/voice-realtime-service/app/main.py`
- Create: `services/voice-realtime-service/app/api/router.py`
- Create: `services/voice-realtime-service/app/core/config.py`
- Create: `services/voice-realtime-service/tests/test_health.py`

- [ ] **Step 1: Write a failing service smoke test**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/voice-realtime-service && uv run pytest tests/test_health.py -v
```

Expected: FAIL because service does not exist.

- [ ] **Step 2: Scaffold FastAPI app with health/provider endpoints**

Add:
- `/healthz`
- `/providers`

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/voice-realtime-service && uv run pytest tests/test_health.py -v
```

Expected: PASS

## Chunk 4: Realtime STT and finalization pipeline

### Task 4: Add sherpa-onnx realtime adapter and FunASR finalizer abstractions

**Files:**
- Create: `services/voice-realtime-service/app/stt/realtime_sherpa.py`
- Create: `services/voice-realtime-service/app/stt/final_funasr.py`
- Create: `services/voice-realtime-service/app/stt/base.py`
- Test: `services/voice-realtime-service/tests/test_stt_pipeline.py`

- [ ] **Step 1: Write failing unit tests for partial/final transcript flow**

Test:
- partial transcript returns low-latency text
- finalizer rewrites transcript at sentence end

- [ ] **Step 2: Implement provider interfaces and deterministic test doubles**

Keep production adapter boundaries stable:
- `stream_partial()`
- `finalize_segment()`

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/voice-realtime-service && uv run pytest tests/test_stt_pipeline.py -v
```

Expected: PASS

## Chunk 5: Entity normalization

### Task 5: Normalize business entities before AI

**Files:**
- Create: `services/voice-realtime-service/app/nlu/entity_normalizer.py`
- Create: `services/voice-realtime-service/app/nlu/dictionaries.py`
- Test: `services/voice-realtime-service/tests/test_entity_normalizer.py`

- [ ] **Step 1: Write failing tests for business term normalization**

Examples:
- `爱疯16破` -> `iPhone 16 Pro`
- `apple care` -> `AppleCare+`
- `国金店` -> canonical store name

- [ ] **Step 2: Implement rules and dictionaries**

Keep this deterministic and explicit; do not rely on LLM rewriting for canonicalization.

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/voice-realtime-service && uv run pytest tests/test_entity_normalizer.py -v
```

Expected: PASS

## Chunk 6: Voice orchestrator and AI bridge

### Task 6: Connect transcripts to ai-service decisions

**Files:**
- Create: `services/voice-realtime-service/app/orchestrator/voice_orchestrator.py`
- Create: `services/voice-realtime-service/app/events/message_bridge.py`
- Test: `services/voice-realtime-service/tests/test_voice_orchestrator.py`

- [ ] **Step 1: Write failing orchestrator tests**

Cover:
- final transcript -> ai-service -> answer
- final transcript -> ai-service -> clarify
- final transcript -> ai-service -> handoff

- [ ] **Step 2: Implement orchestration**

Responsibilities:
- call finalizer
- normalize text
- call `ai-service`
- bridge answer/clarify/handoff into existing conversation events

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/voice-realtime-service && uv run pytest tests/test_voice_orchestrator.py -v
```

Expected: PASS

## Chunk 7: TTS and playback coordination

### Task 7: Add local TTS adapter and response streaming state

**Files:**
- Create: `services/voice-realtime-service/app/tts/base.py`
- Create: `services/voice-realtime-service/app/tts/sherpa_tts.py`
- Test: `services/voice-realtime-service/tests/test_tts_pipeline.py`

- [ ] **Step 1: Write failing TTS tests**

Cover:
- text -> audio asset metadata
- interruption resets speaking state

- [ ] **Step 2: Implement local TTS adapter**

Keep provider boundary:
- `speak(text)`
- `speak_stream(chunks)`

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/services/voice-realtime-service && uv run pytest tests/test_tts_pipeline.py -v
```

Expected: PASS

## Chunk 8: Frontend H5 voice mode

### Task 8: Add H5 realtime voice entry and transcript UI

**Files:**
- Modify: `apps/customer-h5/src/components/chat-workspace.tsx`
- Create: `apps/customer-h5/src/hooks/use-voice-session.ts`
- Create: `apps/customer-h5/src/components/voice-composer.tsx`
- Modify: `apps/customer-h5/src/lib/runtime-config.ts`
- Test: `apps/customer-h5/src/components/voice-composer.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover:
- mic start
- partial transcript render
- final transcript render
- speaking/handoff states

- [ ] **Step 2: Implement minimal voice mode UI**

Add:
- mic button
- listening/thinking/speaking states
- transcript preview
- handoff notice

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/apps/customer-h5 && pnpm test src/components/voice-composer.test.tsx
```

Expected: PASS

## Chunk 9: Admin handoff visibility

### Task 9: Surface voice session states in admin conversation workspace

**Files:**
- Modify: `apps/admin-web/src/routes/conversations.tsx`
- Create: `apps/admin-web/src/components/voice-session-panel.tsx`
- Test: `apps/admin-web/src/routes/conversations.voice.test.tsx`

- [ ] **Step 1: Write failing admin voice state tests**

Cover:
- voice session badge
- transcript list
- handoff summary visibility

- [ ] **Step 2: Implement admin panel additions**

Show:
- current voice state
- final transcripts
- handoff reason
- jump to human reply

- [ ] **Step 3: Run focused tests**

Run:
```bash
cd /Users/west/dev/code/west/west-ai-agent/apps/admin-web && pnpm test src/routes/conversations.voice.test.tsx
```

Expected: PASS

## Chunk 10: Docker and local private stack

### Task 10: Wire LiveKit and voice-realtime-service into local/private stack

**Files:**
- Modify: `infra/docker/docker-compose.yml`
- Modify: `infra/docker/docker-compose.prod.yml`
- Create: `services/voice-realtime-service/Dockerfile`
- Modify: `.env.example`
- Modify: `.env.prod.example`

- [ ] **Step 1: Add failing smoke expectations**

Extend stack smoke to require:
- LiveKit health
- voice-realtime-service health

- [ ] **Step 2: Add service definitions and env vars**

Map high ports and keep naming aligned with `west-ai-agent-*`.

- [ ] **Step 3: Run compose config validation**

Run:
```bash
docker compose -f infra/docker/docker-compose.yml config
```

Expected: PASS

## Chunk 11: Browser E2E

### Task 11: Add real browser tests for voice flow

**Files:**
- Create: `tests/e2e/voice-customer-service.spec.ts`
- Modify: `tests/e2e/helpers.ts`

- [ ] **Step 1: Write failing Playwright scenarios**

Cover:
- H5 enters voice mode
- partial transcript appears
- AI answer appears
- handoff path appears
- admin sees transcript in same conversation

- [ ] **Step 2: Implement browser stubs for media devices where necessary**

Use real Chromium plus deterministic media stubs.

- [ ] **Step 3: Run focused E2E**

Run:
```bash
QWEN_API_KEY=... pnpm test:e2e -- --grep "voice"
```

Expected: PASS

## Chunk 12: Full regression and docs

### Task 12: Run full verification and document local usage

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-07-acceptance-test-report.md`

- [ ] **Step 1: Run repo verification**

Run:
```bash
pnpm verify
```

Expected: PASS

- [ ] **Step 2: Run voice-focused smoke**

Run:
```bash
QWEN_API_KEY=... pnpm test:smoke
```

Expected: PASS

- [ ] **Step 3: Update docs**

Document:
- local private stack
- voice service env vars
- H5/admin voice test path
- limitations and fallback behavior

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add local private realtime voice customer service"
```

Plan complete and saved to `docs/superpowers/plans/2026-04-09-smart-voice-customer-service.md`. Ready to execute?
