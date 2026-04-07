# Final Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成企业级智能客服平台剩余的生产化、AI 多 provider、知识库运营流、Flutter Android 收尾、后台增强页与交付清理。

**Architecture:** 在现有 monorepo 基础上，不重构主链路。优先补齐真实 provider、知识索引管理、移动端发布配置和部署文档；所有变更必须带对应测试或验证脚本，最终通过统一验证链与页面端到端测试收口。

**Tech Stack:** React, TanStack Router, Vite, FastAPI, PostgreSQL, Redis, OpenSearch, MinIO, Flutter, Playwright, pytest

---

## Track 1: 生产化配置与部署文档
- [ ] 新增 `.env.example`，覆盖 Web/H5/Python/Flutter/Docker 所需变量
- [ ] 完善 `README.md` 与 `infra/docker/README.md` 的启动、测试、部署说明
- [ ] 将本地烟测/联调所需变量整理成标准入口，不再依赖隐式 shell 状态

## Track 2: AI 多 provider 真接入
- [ ] 为 `vllm` provider 实现 OpenAI-compatible 调用与测试
- [ ] 为 `ollama` provider 实现真实 `/api/chat` 调用与测试
- [ ] provider registry、providers 接口和 smoke 验证覆盖三类 provider

## Track 3: 知识库运营链增强
- [ ] 补齐知识导入/重建索引/发布状态展示接口与前端操作
- [ ] worker-jobs 增加更明确的索引任务返回与可观测结果
- [ ] admin-web 知识工坊增加索引/发布管理面板和测试

## Track 4: Flutter Android 收尾
- [ ] 去掉 placeholder 应用描述，更新 Android applicationId / namespace 为正式值
- [ ] 替换 release 签名 TODO 为明确的配置说明和默认安全降级
- [ ] 尝试本机 Android 构建验证，若受环境限制则准确记录阻塞

## Track 5: 后台增强页与页面一致性
- [ ] 补强分析、报表、视频客服、设置页的真实数据表现与操作面板
- [ ] 保持主题与交互一致，增加必要组件级测试

## Track 6: 仓库清理与交付收口
- [ ] 补齐 `.editorconfig`、`.gitignore`、基础仓库元文件
- [ ] 清理明显 placeholder 文案与交付说明中的过时内容
- [ ] 运行统一验证：`pnpm verify`、前端单测、`pnpm test:e2e`、`pnpm test:smoke`、`pnpm test:mobile-flutter`
