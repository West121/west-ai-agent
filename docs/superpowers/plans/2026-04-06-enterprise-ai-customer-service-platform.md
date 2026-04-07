# 企业级智能客服与知识库平台 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一套支持私有化部署的企业级智能客服与知识库平台，覆盖 Web、H5、Flutter 多端，以及 AI 客服、知识库和会话中心。

**Architecture:** 采用 monorepo 结构，前端拆分为 Web 管理端、H5 访客端和 Flutter 移动端，后端拆分为平台主 API、消息网关、AI 服务与异步任务服务。实时会话链路、AI 问答链路与后台管理链路分层治理。

**Tech Stack:** React, TanStack Router, TanStack Query, shadcn/ui, Tailwind CSS, Flutter, FastAPI, PostgreSQL, Redis, OpenSearch, MinIO, vLLM, Ollama, Docker Compose

---

## 推荐代码结构

### 应创建的顶层目录

- `apps/admin-web`
- `apps/customer-h5`
- `apps/mobile-flutter`
- `services/platform-api`
- `services/message-gateway`
- `services/ai-service`
- `services/worker-jobs`
- `packages/contracts`
- `packages/design-tokens`
- `infra/docker`
- `docs/plans`
- `docs/superpowers/plans`

### 文件职责映射

- `apps/admin-web/src/routes/*`
  - 后台管理端与坐席工作台页面
- `apps/customer-h5/src/routes/*`
  - 独立 H5 与嵌入 H5 页面
- `apps/mobile-flutter/lib/*`
  - Flutter 页面、路由、状态和 API SDK
- `services/platform-api/app/*`
  - 主业务 API
- `services/message-gateway/app/*`
  - WebSocket、在线状态、消息投递
- `services/ai-service/app/*`
  - 模型网关、检索编排、转人工策略
- `services/worker-jobs/app/*`
  - 文档解析、索引、报表任务
- `packages/contracts/*`
  - 前后端共享接口契约

## Chunk 1: Monorepo Scaffold

### Task 1: 初始化 monorepo 与基础目录

**Files:**
- Create: `apps/admin-web/`
- Create: `apps/customer-h5/`
- Create: `apps/mobile-flutter/`
- Create: `services/platform-api/`
- Create: `services/message-gateway/`
- Create: `services/ai-service/`
- Create: `services/worker-jobs/`
- Create: `packages/contracts/`
- Create: `infra/docker/`

- [ ] Step 1: 创建目录结构
- [ ] Step 2: 增加根级 README，说明多端与服务职责
- [ ] Step 3: 约定统一环境变量命名规范
- [ ] Step 4: 提交脚手架初始化

### Task 2: 建立共享接口契约包

**Files:**
- Create: `packages/contracts/src/conversation.ts`
- Create: `packages/contracts/src/message.ts`
- Create: `packages/contracts/src/knowledge.ts`
- Create: `packages/contracts/src/ai.ts`
- Create: `packages/contracts/src/index.ts`

- [ ] Step 1: 定义 conversation DTO
- [ ] Step 2: 定义 message DTO
- [ ] Step 3: 定义 knowledge DTO
- [ ] Step 4: 定义 ai decision DTO
- [ ] Step 5: 提交 contracts 初版

## Chunk 2: Platform API

### Task 3: 初始化 FastAPI 主服务

**Files:**
- Create: `services/platform-api/app/main.py`
- Create: `services/platform-api/app/api/router.py`
- Create: `services/platform-api/app/core/config.py`
- Create: `services/platform-api/app/core/db.py`
- Create: `services/platform-api/app/models/`
- Create: `services/platform-api/tests/`

- [ ] Step 1: 搭建 FastAPI 入口与健康检查接口
- [ ] Step 2: 配置数据库连接与 settings
- [ ] Step 3: 建立测试目录与基础测试
- [ ] Step 4: 跑通健康检查测试
- [ ] Step 5: 提交 platform-api 初始化

### Task 4: 身份权限模块

**Files:**
- Create: `services/platform-api/app/modules/auth/models.py`
- Create: `services/platform-api/app/modules/auth/schemas.py`
- Create: `services/platform-api/app/modules/auth/service.py`
- Create: `services/platform-api/app/modules/auth/router.py`
- Create: `services/platform-api/tests/modules/auth/test_auth_login.py`

- [ ] Step 1: 先写登录与权限校验失败测试
- [ ] Step 2: 建立 user/role/permission 基础模型
- [ ] Step 3: 实现登录与 token 签发
- [ ] Step 4: 实现角色权限读取
- [ ] Step 5: 跑通 auth 测试
- [ ] Step 6: 提交 auth 模块

### Task 5: 渠道配置与 H5 链接生成

**Files:**
- Create: `services/platform-api/app/modules/channel/models.py`
- Create: `services/platform-api/app/modules/channel/schemas.py`
- Create: `services/platform-api/app/modules/channel/service.py`
- Create: `services/platform-api/app/modules/channel/router.py`
- Create: `services/platform-api/tests/modules/channel/test_channel_h5_link.py`

- [ ] Step 1: 先写 H5 链接生成测试
- [ ] Step 2: 实现 channel_app 模型
- [ ] Step 3: 实现独立 H5 链接、嵌入 H5 配置接口
- [ ] Step 4: 跑通 channel 测试
- [ ] Step 5: 提交 channel 模块

### Task 6: 客户中心模块

**Files:**
- Create: `services/platform-api/app/modules/customer/models.py`
- Create: `services/platform-api/app/modules/customer/schemas.py`
- Create: `services/platform-api/app/modules/customer/service.py`
- Create: `services/platform-api/app/modules/customer/router.py`
- Create: `services/platform-api/tests/modules/customer/test_customer_profile.py`

- [ ] Step 1: 写客户资料 CRUD 测试
- [ ] Step 2: 实现 customer_profile、tag、blacklist
- [ ] Step 3: 实现查询与更新接口
- [ ] Step 4: 跑通 customer 测试
- [ ] Step 5: 提交 customer 模块

### Task 7: 会话中心模块

**Files:**
- Create: `services/platform-api/app/modules/conversation/models.py`
- Create: `services/platform-api/app/modules/conversation/schemas.py`
- Create: `services/platform-api/app/modules/conversation/service.py`
- Create: `services/platform-api/app/modules/conversation/router.py`
- Create: `services/platform-api/tests/modules/conversation/test_conversation_lifecycle.py`

- [ ] Step 1: 写会话创建/结束/转接失败测试
- [ ] Step 2: 实现 conversation、conversation_event 模型
- [ ] Step 3: 实现生命周期接口
- [ ] Step 4: 跑通 conversation 测试
- [ ] Step 5: 提交 conversation 模块

## Chunk 3: Message Gateway

### Task 8: 初始化消息网关

**Files:**
- Create: `services/message-gateway/app/main.py`
- Create: `services/message-gateway/app/ws/router.py`
- Create: `services/message-gateway/app/services/presence.py`
- Create: `services/message-gateway/app/services/delivery.py`
- Create: `services/message-gateway/tests/test_ws_health.py`

- [ ] Step 1: 写 WebSocket 基础连接测试
- [ ] Step 2: 实现连接鉴权和心跳
- [ ] Step 3: 实现在线状态服务
- [ ] Step 4: 跑通 ws 测试
- [ ] Step 5: 提交 message-gateway 初始化

### Task 9: 消息收发与未读数

**Files:**
- Create: `services/message-gateway/app/services/message_ingest.py`
- Create: `services/message-gateway/app/services/unread_counter.py`
- Create: `services/message-gateway/tests/test_message_delivery.py`

- [ ] Step 1: 写消息收发测试
- [ ] Step 2: 实现消息投递与广播
- [ ] Step 3: 实现未读数与回执
- [ ] Step 4: 跑通消息测试
- [ ] Step 5: 提交消息能力

## Chunk 4: Knowledge Service and Worker Jobs

### Task 10: 知识主档与发布流

**Files:**
- Create: `services/platform-api/app/modules/knowledge/models.py`
- Create: `services/platform-api/app/modules/knowledge/schemas.py`
- Create: `services/platform-api/app/modules/knowledge/service.py`
- Create: `services/platform-api/app/modules/knowledge/router.py`
- Create: `services/platform-api/tests/modules/knowledge/test_publish_flow.py`

- [ ] Step 1: 写知识草稿/审核/发布测试
- [ ] Step 2: 实现知识主档、版本、状态机
- [ ] Step 3: 实现发布接口
- [ ] Step 4: 跑通知识测试
- [ ] Step 5: 提交 knowledge 主流程

### Task 11: 异步文档解析与切片

**Files:**
- Create: `services/worker-jobs/app/main.py`
- Create: `services/worker-jobs/app/jobs/document_parse.py`
- Create: `services/worker-jobs/app/jobs/chunk_build.py`
- Create: `services/worker-jobs/app/jobs/search_index.py`
- Create: `services/worker-jobs/tests/test_chunk_build.py`

- [ ] Step 1: 写 FAQ 与文档切片测试
- [ ] Step 2: 实现解析中间格式
- [ ] Step 3: 实现 chunk 生成与 metadata 绑定
- [ ] Step 4: 实现 OpenSearch 索引任务
- [ ] Step 5: 跑通切片测试
- [ ] Step 6: 提交 worker-jobs 初版

## Chunk 5: AI Service

### Task 12: 初始化 AI 服务与模型网关

**Files:**
- Create: `services/ai-service/app/main.py`
- Create: `services/ai-service/app/api/router.py`
- Create: `services/ai-service/app/providers/base.py`
- Create: `services/ai-service/app/providers/vllm_provider.py`
- Create: `services/ai-service/app/providers/ollama_provider.py`
- Create: `services/ai-service/app/providers/openai_like_provider.py`
- Create: `services/ai-service/tests/test_model_gateway.py`

- [ ] Step 1: 写模型路由测试
- [ ] Step 2: 抽象 provider 接口
- [ ] Step 3: 实现 vLLM provider
- [ ] Step 4: 实现 Ollama provider
- [ ] Step 5: 实现第三方兼容 provider
- [ ] Step 6: 跑通 gateway 测试
- [ ] Step 7: 提交 model gateway

### Task 13: RAG 编排与 AI 决策

**Files:**
- Create: `services/ai-service/app/services/query_rewrite.py`
- Create: `services/ai-service/app/services/retrieval.py`
- Create: `services/ai-service/app/services/rerank.py`
- Create: `services/ai-service/app/services/answer_generation.py`
- Create: `services/ai-service/app/services/decision_policy.py`
- Create: `services/ai-service/app/api/chat.py`
- Create: `services/ai-service/tests/test_ai_handoff_policy.py`

- [ ] Step 1: 写低置信度转人工测试
- [ ] Step 2: 实现 hybrid retrieval
- [ ] Step 3: 实现 answer generation
- [ ] Step 4: 实现 answer/clarify/handoff/reject 判定
- [ ] Step 5: 跑通 ai 决策测试
- [ ] Step 6: 提交 ai-service 主链路

### Task 14: AI 审计与回放

**Files:**
- Create: `services/ai-service/app/services/trace_writer.py`
- Create: `services/platform-api/app/modules/ai_audit/router.py`
- Create: `services/platform-api/tests/modules/ai_audit/test_trace_query.py`

- [ ] Step 1: 写 trace 落库与查询测试
- [ ] Step 2: 实现 ai_session_trace 写入
- [ ] Step 3: 实现后台回放接口
- [ ] Step 4: 跑通 ai audit 测试
- [ ] Step 5: 提交审计模块

## Chunk 6: Admin Web

### Task 15: 初始化 Web 管理端

**Files:**
- Create: `apps/admin-web/src/main.tsx`
- Create: `apps/admin-web/src/router.tsx`
- Create: `apps/admin-web/src/routes/__root.tsx`
- Create: `apps/admin-web/src/routes/login.tsx`
- Create: `apps/admin-web/src/routes/dashboard.tsx`
- Create: `apps/admin-web/src/components/layout/app-shell.tsx`

- [ ] Step 1: 初始化 React + TanStack Router
- [ ] Step 2: 配置 shadcn/ui 与 design tokens
- [ ] Step 3: 建立登录页与后台骨架
- [ ] Step 4: 提交 admin-web 初始化

### Task 16: 坐席工作台

**Files:**
- Create: `apps/admin-web/src/routes/workbench.tsx`
- Create: `apps/admin-web/src/features/workbench/conversation-list.tsx`
- Create: `apps/admin-web/src/features/workbench/message-panel.tsx`
- Create: `apps/admin-web/src/features/workbench/customer-sidebar.tsx`
- Create: `apps/admin-web/src/features/workbench/action-bar.tsx`
- Create: `apps/admin-web/src/features/workbench/ai-assist-panel.tsx`

- [ ] Step 1: 先写核心组件状态测试
- [ ] Step 2: 实现三栏布局
- [ ] Step 3: 接入会话查询与消息流
- [ ] Step 4: 接入转接、结束、评价
- [ ] Step 5: 接入 AI 推荐回复和转人工摘要
- [ ] Step 6: 提交 workbench

### Task 17: 知识库后台与 AI 运营后台

**Files:**
- Create: `apps/admin-web/src/routes/knowledge/index.tsx`
- Create: `apps/admin-web/src/routes/knowledge/$id.tsx`
- Create: `apps/admin-web/src/routes/ai-ops/index.tsx`
- Create: `apps/admin-web/src/features/knowledge/*`
- Create: `apps/admin-web/src/features/ai-ops/*`

- [ ] Step 1: 实现知识列表与编辑页
- [ ] Step 2: 实现发布流
- [ ] Step 3: 实现模型配置与策略页
- [ ] Step 4: 实现机器人效果看板
- [ ] Step 5: 提交 knowledge + ai-ops

### Task 17A: 管理后台扩展页面

**Files:**
- Create: `apps/admin-web/src/routes/users.tsx`
- Create: `apps/admin-web/src/routes/roles.tsx`
- Create: `apps/admin-web/src/routes/channels.tsx`
- Create: `apps/admin-web/src/routes/settings.tsx`
- Create: `apps/admin-web/src/routes/leave-messages.tsx`
- Create: `apps/admin-web/src/routes/history-sessions.tsx`
- Create: `apps/admin-web/src/routes/routing-rules.tsx`
- Create: `apps/admin-web/src/routes/agent-settings.tsx`
- Create: `apps/admin-web/src/routes/video-service.tsx`
- Create: `apps/admin-web/src/routes/tickets.tsx`
- Create: `apps/admin-web/src/routes/export-management.tsx`
- Create: `apps/admin-web/src/routes/quality-review.tsx`
- Create: `apps/admin-web/src/routes/crm-embed.tsx`
- Create: `apps/admin-web/src/routes/group-monitor.tsx`
- Create: `apps/admin-web/src/routes/agent-monitor.tsx`
- Create: `apps/admin-web/src/routes/report-center.tsx`

- [ ] Step 1: 建立用户、角色、渠道、系统设置页面骨架
- [ ] Step 2: 建立留言、历史会话、工单、导出、质检页面骨架
- [ ] Step 3: 建立监控、报表、分配规则、客服设置和视频客服页面
- [ ] Step 4: 接入页面级查询参数与筛选状态
- [ ] Step 5: 提交 admin 扩展后台

### Task 17B: 机器人后台页面

**Files:**
- Create: `apps/admin-web/src/routes/robot/dashboard.tsx`
- Create: `apps/admin-web/src/routes/robot/knowledge.tsx`
- Create: `apps/admin-web/src/routes/robot/lexicon.tsx`
- Create: `apps/admin-web/src/routes/robot/business-settings.tsx`
- Create: `apps/admin-web/src/routes/robot/data-analysis.tsx`
- Create: `apps/admin-web/src/routes/robot/business-monitor.tsx`
- Create: `apps/admin-web/src/routes/robot/detail.tsx`
- Create: `apps/admin-web/src/routes/robot/simulation.tsx`
- Create: `apps/admin-web/src/routes/robot/open-api.tsx`
- Create: `apps/admin-web/src/routes/robot/parameter-config.tsx`

- [ ] Step 1: 建立机器人后台路由分组
- [ ] Step 2: 实现仪表盘、知识管理、词库和业务设置页面
- [ ] Step 3: 实现数据分析、业务监控、详情与模拟对话页面
- [ ] Step 4: 实现对外接口与参数配置页面
- [ ] Step 5: 提交 robot admin 初版

## Chunk 7: Customer H5

### Task 18: 初始化 H5 客服端

**Files:**
- Create: `apps/customer-h5/src/main.tsx`
- Create: `apps/customer-h5/src/router.tsx`
- Create: `apps/customer-h5/src/routes/index.tsx`
- Create: `apps/customer-h5/src/routes/chat.tsx`
- Create: `apps/customer-h5/src/components/layout/chat-shell.tsx`

- [ ] Step 1: 初始化 React + TanStack Router
- [ ] Step 2: 实现独立 H5 与嵌入模式路由参数
- [ ] Step 3: 实现基础会话页框架
- [ ] Step 4: 提交 customer-h5 初始化

### Task 19: H5 会话主流程

**Files:**
- Create: `apps/customer-h5/src/features/chat/message-list.tsx`
- Create: `apps/customer-h5/src/features/chat/input-bar.tsx`
- Create: `apps/customer-h5/src/features/chat/faq-entry.tsx`
- Create: `apps/customer-h5/src/features/chat/handoff-banner.tsx`

- [ ] Step 1: 实现消息列表与输入条
- [ ] Step 2: 接入 FAQ、快捷入口和文件上传
- [ ] Step 3: 接入 AI 回复、转人工状态
- [ ] Step 4: 提交 H5 会话主流程

### Task 19A: H5 留言与满意度闭环

**Files:**
- Create: `apps/customer-h5/src/routes/leave-message.tsx`
- Create: `apps/customer-h5/src/routes/history.tsx`
- Create: `apps/customer-h5/src/routes/rating.tsx`
- Create: `apps/customer-h5/src/features/leave-message/*`

- [ ] Step 1: 实现留言页和提交结果页
- [ ] Step 2: 实现历史记录与满意度页
- [ ] Step 3: 接入离线转留言与评价入口
- [ ] Step 4: 提交 H5 留言闭环

## Chunk 8: Flutter Mobile

### Task 20: Flutter 基础工程与 API SDK

**Files:**
- Create: `apps/mobile-flutter/lib/main.dart`
- Create: `apps/mobile-flutter/lib/router/app_router.dart`
- Create: `apps/mobile-flutter/lib/core/network/api_client.dart`
- Create: `apps/mobile-flutter/lib/features/chat/*`

- [ ] Step 1: 初始化 Flutter 工程
- [ ] Step 2: 建立路由、网络、状态管理骨架
- [ ] Step 3: 建立聊天页和历史页骨架
- [ ] Step 4: 提交 mobile-flutter 初始化

### Task 21: Flutter 会话与嵌入能力

**Files:**
- Create: `apps/mobile-flutter/lib/features/chat/chat_page.dart`
- Create: `apps/mobile-flutter/lib/features/chat/history_page.dart`
- Create: `apps/mobile-flutter/lib/features/webview/embedded_h5_page.dart`

- [ ] Step 1: 接入原生消息会话
- [ ] Step 2: 接入满意度和留言
- [ ] Step 3: 支持打开嵌入 H5 客服页
- [ ] Step 4: 提交 Flutter 会话能力

### Task 21A: Flutter 历史与评价能力

**Files:**
- Create: `apps/mobile-flutter/lib/features/history/history_page.dart`
- Create: `apps/mobile-flutter/lib/features/rating/rating_page.dart`

- [ ] Step 1: 实现历史会话列表
- [ ] Step 2: 实现满意度与反馈表单
- [ ] Step 3: 接入历史详情与评价提交
- [ ] Step 4: 提交 Flutter 历史评价能力

## Chunk 9: Infra and Delivery

### Task 22: Docker Compose 本地私有化环境

**Files:**
- Create: `infra/docker/docker-compose.yml`
- Create: `infra/docker/platform-api.Dockerfile`
- Create: `infra/docker/message-gateway.Dockerfile`
- Create: `infra/docker/ai-service.Dockerfile`
- Create: `infra/docker/worker-jobs.Dockerfile`

- [ ] Step 1: 编排 PostgreSQL、Redis、OpenSearch、MinIO
- [ ] Step 2: 编排 Python 服务
- [ ] Step 3: 增加启动说明
- [ ] Step 4: 提交 compose 环境

### Task 23: 基础验收与联调清单

**Files:**
- Create: `docs/plans/phase-1-acceptance-checklist.md`

- [ ] Step 1: 列出会话主流程验收项
- [ ] Step 2: 列出知识发布与检索验收项
- [ ] Step 3: 列出 AI 转人工验收项
- [ ] Step 4: 列出多端联调验收项
- [ ] Step 5: 提交验收清单

## Chunk 10: Extended Platform Modules

### Task 24: 平台 API 扩展模块

**Files:**
- Create: `services/platform-api/app/modules/ticket/*`
- Create: `services/platform-api/app/modules/export_task/*`
- Create: `services/platform-api/app/modules/quality_review/*`
- Create: `services/platform-api/app/modules/reporting/*`
- Create: `services/platform-api/app/modules/crm_embed/*`
- Create: `services/platform-api/app/modules/routing_rule/*`
- Create: `services/platform-api/app/modules/agent_setting/*`
- Create: `services/platform-api/app/modules/video_service/*`

- [ ] Step 1: 实现留言、历史会话、工单、导出任务的数据模型
- [ ] Step 2: 实现质检评分、CRM 嵌入、路由规则接口
- [ ] Step 3: 实现客服设置、视频客服和报表接口
- [ ] Step 4: 为扩展模块补测试
- [ ] Step 5: 提交 platform 扩展模块

### Task 25: AI 服务扩展能力

**Files:**
- Create: `services/ai-service/app/services/sensitive_filter.py`
- Create: `services/ai-service/app/services/suggestion_engine.py`
- Create: `services/ai-service/app/services/intent_dictionary.py`
- Create: `services/ai-service/app/services/fallback_chat.py`
- Create: `services/ai-service/app/services/open_api_adapter.py`

- [ ] Step 1: 实现敏感词、频控和黑名单处理
- [ ] Step 2: 实现相关问题推荐和输入联想
- [ ] Step 3: 实现闲聊兜底和多样化回答
- [ ] Step 4: 实现对外问答接口适配层
- [ ] Step 5: 提交 ai-service 扩展能力

## 实施顺序建议

按以下顺序执行最稳：

1. Monorepo Scaffold
2. Platform API
3. Message Gateway
4. Knowledge + Worker Jobs
5. AI Service
6. Admin Web
7. Customer H5
8. Flutter Mobile
9. Infra and Delivery

## 当前原型交付状态

- 当前已完成 `43` 个页面原型，覆盖 Web、H5、Flutter 和机器人后台。
- 已精修页面可直接作为前端开发参考：
  - 坐席工作台
  - H5 会话页
  - 知识编辑
  - AI 运营配置
  - 工单管理
  - 留言管理
  - 历史会话
  - 导出管理
  - 质检评分
  - 报表中心
  - 机器人仪表盘
  - 机器人业务设置
  - 机器人数据分析
  - 机器人业务监控
  - 机器人对外接口
  - 机器人参数配置
  - 移动端登录页
  - 移动端我的页
- Web 工作台侧边栏已补齐为完整后台菜单。
- Flutter 首页、会话页、历史页已补齐底部 Tab。
- 其余页面已达到结构化实现级，可在开发阶段补齐弹窗、空态、批量操作和权限态细节。

Plan complete and saved to `docs/superpowers/plans/2026-04-06-enterprise-ai-customer-service-platform.md`. Ready to execute?
