# Remaining Enterprise AI Customer Service Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐当前剩余的前后端闭环能力，并完成单元、集成和页面功能测试。

**Architecture:** 继续保持 monorepo 分层。平台 API、消息网关、AI 检索链路已经可运行，本轮集中补齐三端功能消费层和端到端测试层，避免继续扩散到底层基础设施。

**Tech Stack:** React, TanStack Router, TanStack Query, Vite, Playwright, Flutter, FastAPI, PostgreSQL, Redis, OpenSearch, MinIO

---

## Remaining Scope

### Track A: admin-web 完整功能闭环
- [ ] 补齐会话工作台的真实操作闭环：转接、结束、摘要刷新、满意度查看
- [ ] 补齐知识工坊闭环：创建文档、提交审核、发布版本、结果回显
- [ ] 补齐渠道/H5 配置闭环：生成 H5 链接、复制与打开验证
- [ ] 为关键后台页增加组件级交互测试或页面级 smoke

### Track B: customer-h5 访客侧闭环
- [ ] 在聊天流中接入 AI 决策接口，发送消息后展示 AI 应答/转人工建议
- [ ] 保持消息历史、回执、满意度、留言流程稳定
- [ ] 增加 H5 页面级功能测试

### Track C: mobile-flutter 主流程闭环
- [ ] 登录后接入真实首页/历史/我的数据刷新
- [ ] Chat 页面补齐真实消息流或会话摘要操作闭环
- [ ] 增加 widget/integration 级验证，确保 iOS simulator 可启动

### Track D: 统一页面功能测试
- [ ] Playwright 覆盖 admin-web 关键操作流
- [ ] Playwright 覆盖 customer-h5 standalone 留言/聊天/满意度流
- [ ] 汇总前后端单元、烟测、Flutter 测试与页面功能测试命令

