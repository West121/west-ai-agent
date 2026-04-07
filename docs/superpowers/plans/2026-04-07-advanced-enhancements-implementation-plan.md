# Advanced Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 WebRTC 视频客服、运营分析型报表图表和 LangGraph 复杂流程增强，并通过本地浏览器和后端回归验证。

**Architecture:** 保留现有 Web/H5/API/AI 主链路，在 `message-gateway` 增加视频信令，在 `platform-api` 扩展视频与报表聚合，在 `ai-service` 增加 LangGraph 专用流程服务。前端只在现有页面上增强，不改整体路由结构。

**Tech Stack:** React + TanStack Router + FastAPI + SQLAlchemy + WebSocket + WebRTC + MediaRecorder + LangGraph + Playwright + pytest + vitest

---

### Task 1: 视频客服后端与信令

**Files:**
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/message-gateway/app/ws/router.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/message-gateway/tests/test_message_delivery.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/app/modules/video/models.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/app/modules/video/schemas.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/app/modules/video/crud.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/app/modules/video/router.py`
- Create: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/tests/modules/video/test_video_recording_module.py`

- [ ] 写视频信令与录制元数据的失败测试
- [ ] 在 message-gateway 增加 `video.offer/video.answer/video.ice-candidate/video.recording.*` 事件广播
- [ ] 在 platform-api 为视频会话增加录制文件、回放列表、会后摘要字段和接口
- [ ] 跑视频相关 pytest，确认通过

### Task 2: 视频客服前端

**Files:**
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/lib/platform-api.ts`
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/hooks/use-platform-api.ts`
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/routes/video-service.tsx`
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/routes/video-service.test.tsx`

- [ ] 为视频页写失败测试，覆盖开始会话、信令状态、录制、回放、会后摘要、转工单
- [ ] 接入浏览器 WebRTC 和 MediaRecorder
- [ ] 渲染回放列表和播放区域
- [ ] 跑 `admin-web` 单测，确认通过

### Task 3: 报表图表后端聚合

**Files:**
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/app/modules/conversation/router.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/app/modules/service/router.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/tests/modules/conversation/test_conversation_module.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/platform-api/tests/modules/service/test_service_module.py`

- [ ] 为趋势图和分布图需要的聚合响应写失败测试
- [ ] 扩展 analytics/dashboard 响应，增加趋势和分布数据
- [ ] 跑相关 pytest，确认通过

### Task 4: 报表图表前端

**Files:**
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/routes/analytics.tsx`
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/routes/report-center.tsx`
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/routes/backend-enhancement.test.tsx`
- Modify: `/Users/west/dev/code/west/west-ai-agent/apps/admin-web/src/routes/enhancement-pages.test.tsx`

- [ ] 为图表渲染和筛选交互写失败测试
- [ ] 加入趋势图、分布图和关键运营指标图表
- [ ] 跑 `admin-web` 单测，确认通过

### Task 5: LangGraph 复杂流程后端

**Files:**
- Create: `/Users/west/dev/code/west/west-ai-agent/services/ai-service/app/workflow/langgraph_service.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/ai-service/app/workflow/service.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/ai-service/app/workflow/types.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/ai-service/app/api/router.py`
- Modify: `/Users/west/dev/code/west/west-ai-agent/services/ai-service/tests/test_workflow_api.py`

- [ ] 写退款/售后/账号冻结三类流程的失败测试
- [ ] 引入 LangGraph 服务，仅接管复杂流程
- [ ] 保持普通 FAQ/RAG 仍走旧链路
- [ ] 跑 ai-service pytest，确认通过

### Task 6: 浏览器与本地联调验证

**Files:**
- Modify: `/Users/west/dev/code/west/west-ai-agent/tests/e2e/admin-web.spec.ts`
- Modify: `/Users/west/dev/code/west/west-ai-agent/tests/e2e/customer-h5.spec.ts`
- Modify: `/Users/west/dev/code/west/west-ai-agent/scripts/run-e2e.mjs`
- Modify: `/Users/west/dev/code/west/west-ai-agent/docs/superpowers/plans/2026-04-07-acceptance-test-report.md`

- [ ] 扩展 Playwright 场景，覆盖视频客服、报表图表和复杂流程
- [ ] 本地启动 Docker 依赖与服务
- [ ] 运行 `pnpm verify`
- [ ] 运行 `pnpm test:e2e`
- [ ] 运行 `pnpm test:smoke`
- [ ] 更新验收报告
