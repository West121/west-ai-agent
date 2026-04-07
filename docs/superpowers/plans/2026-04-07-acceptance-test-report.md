# Acceptance Test Report

## Scope

本报告覆盖当前仓库的交付闭环验证：

- Web 管理端
- H5 客服端
- Flutter 移动端
- platform-api
- message-gateway
- ai-service
- worker-jobs

## Verification Matrix

### Backend

- `pnpm verify`
  - `platform-api`: pass
  - `message-gateway`: pass
  - `ai-service`: pass
  - `worker-jobs`: pass

### Web / H5

- `pnpm --filter admin-web test -- --runInBand`: pass
- `pnpm test:e2e`: pass
- `pnpm test:smoke`: pass

### Flutter

- `pnpm test:mobile-flutter`: pass
- `pnpm mobile:android:doctor`: pass
- `pnpm mobile:android:build:debug`: pass

## Functional Coverage

### Admin Web

- 登录
- 服务运营台
- 工单创建与更新
- 知识导入、送审、发布
- 报表/导出/质检/视频客服增强页渲染

### Customer H5

- 独立入口建会话
- 实时消息
- 满意度提交
- 留言提交流程

### AI

- provider registry
- Qwen/OpenAI-compatible 调用
- 检索与回答
- `/workflow/triage`

### Mobile

- 登录页
- 首页
- 会话页
- 历史页
- 我的页
- Android debug APK 产物

## Deliverables

- Android debug APK: [app-debug.apk](/Users/west/dev/code/west/west-ai-agent/apps/mobile-flutter/build/app/outputs/flutter-apk/app-debug.apk)
- iOS simulator app: [Runner.app](/Users/west/dev/code/west/west-ai-agent/apps/mobile-flutter/build/ios/iphonesimulator/Runner.app)

## Remaining External Inputs

以下项不是代码阻塞，但需要外部输入才能进入最终生产发布：

- Android release keystore
- 生产环境密钥
- 正式域名 / 证书
