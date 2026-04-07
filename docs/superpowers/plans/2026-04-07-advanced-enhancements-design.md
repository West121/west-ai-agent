# Advanced Enhancements Design

## Scope

本轮增强只覆盖 3 条主线：

1. 视频客服从“最小闭环”升级到 `1v1 WebRTC + WebSocket 信令 + 浏览器端录制回放`
2. 报表中心从指标卡升级到 `运营分析型图表面板`
3. LangGraph 只用于复杂售后流程，不替换当前主问答链路

## 目标

- 视频客服支持真实浏览器端音视频会话、抓拍、录制上传、回放列表和会后摘要
- 报表中心支持趋势、分布和效率类可视化图表
- 复杂流程问答由 LangGraph 编排退款/售后/账号冻结 3 类补槽与转人工
- 所有新增能力都能在本地通过真实浏览器与后端服务完成验证

## 非目标

- 不做多人房间、SFU、TURN 集群、服务端统一转码
- 不把普通 FAQ/RAG 问答迁移到 LangGraph
- 不扩到财务或 BI 级报表体系

## 方案

### 1. 视频客服

采用 `message-gateway` 现有 WebSocket 连接模型，新增 `video.*` 事件用于 SDP/ICE 信令交换：

- `video.offer`
- `video.answer`
- `video.ice-candidate`
- `video.recording.started`
- `video.recording.stopped`

`platform-api` 的 `video` 模块扩展为真实业务元数据中心：

- 视频会话基础信息
- 录制文件元数据
- 抓拍记录
- 会后摘要
- 转工单结果

录制方式首版采用浏览器端 `MediaRecorder`：

- 坐席端录制本地媒体流
- 录制完成后通过 `platform-api` 上传到对象存储
- 在后台页展示回放列表和播放链接

### 2. 报表图表

基于现有 `analytics` 与 `report-center` 数据源补运营分析型图表：

- 会话趋势图
- 转人工率趋势
- 满意度趋势
- 知识命中/拒答分布
- 客服响应时长分布
- 渠道分布与状态分布

首版图表直接在前端用轻量 React 图表库渲染，不增加独立图表服务。

### 3. LangGraph 复杂流程

保留当前 `DecisionPipeline` 主链路，新增 `LangGraphWorkflowService` 只处理：

- 退款
- 售后/工单
- 账号冻结

执行逻辑：

- FAQ/RAG 普通问题：继续走现有 `DecisionPipeline`
- 复杂售后问题：进入 LangGraph 流程图
- 流程图负责补槽、生成追问、准备转人工摘要

## 数据流

### 视频客服

浏览器 A/B 建立 WebRTC：

1. 后台页创建视频会话
2. 通过 `message-gateway` 交换 offer/answer/candidate
3. 建立 P2P 媒体连接
4. 浏览器端录制
5. 上传录制文件元数据到 `platform-api`
6. 后台页读取回放列表和会后摘要

### LangGraph

1. 前端或 H5 提问
2. `ai-service` 先判断复杂流程类别
3. 普通问题走 `DecisionPipeline`
4. 复杂问题走 `LangGraphWorkflowService`
5. 返回 `answer / collect_slot / handoff`

## 测试策略

- 后端：
  - pytest 覆盖视频信令、录制文件元数据、回放、图表聚合接口、LangGraph 流程
- 前端：
  - vitest 覆盖视频页、报表图表页、复杂流程结果页
- 浏览器：
  - Playwright 真实跑 Web 管理台与 H5
  - 至少覆盖视频会话建立、录制元数据、图表渲染、复杂售后流程
- 本地联调：
  - 真实启动 Docker 依赖与业务服务
  - 真实浏览器验证，不只看单测
