# 本地私有智能语音客服设计

## 目标

在现有 `west-ai-agent` 客服平台上新增一条完全本地私有的实时语音客服链路，支持：

- H5/App 端实时语音输入
- AI 实时语音回复
- 低置信度/复杂问题转人工
- 与现有文本会话、知识库、RAG、LangGraph 流程、工单、视频客服共用会话主干
- 语音会话录音、转写、摘要、回放审计

本轮只做本地私有方案，不依赖云端实时语音 API。

---

## 现状约束

当前仓库已经具备：

- `apps/customer-h5`：客户侧文本聊天
- `apps/admin-web`：后台/坐席工作台、视频客服页
- `services/ai-service`：RAG、复杂流程、LangGraph 风格 workflow
- `services/message-gateway`：消息实时广播
- `services/platform-api`：会话、知识、工单、视频录制元数据

当前不具备：

- AI 语音输入到文本的实时识别
- AI 文本到语音的实时播报
- 语音对话会话状态机
- 语音会话专属审计与片段管理

---

## 方案对比

### 方案 A：纯 WebSocket 音频流 + Python 自研

前端直接通过 WebSocket 推送音频分片到后端，自研 VAD、转写、打断、播报管理。

优点：

- 服务少
- 首版开发快

缺点：

- 音频设备、回声抑制、弱网、跨端兼容性都要自己兜底
- 后期从“能说话”升级到“体验稳定”成本高

### 方案 B：LiveKit + 本地语音编排服务

使用自建 `LiveKit` 负责实时媒体，新增 `voice-realtime-service` 负责 STT/TTS、状态机、转人工和文本主链协同。

优点：

- 媒体传输、设备管理、网络适配交给成熟组件
- H5 / iOS / Android 复用一套实时音频基础设施
- 后续升级到真人语音/音视频客服更顺

缺点：

- 新增一个媒体基础设施
- 架构比方案 A 稍重

### 方案 C：直接复用现有视频客服 WebRTC 能力

在 `admin-web` 视频客服基础上继续往客户侧扩展语音房间，并把 AI 嵌进去。

优点：

- 复用现有代码路径

缺点：

- 当前视频能力更偏页面级原型，不适合直接承担统一语音底座
- 容易把“视频客服”和“AI 语音客服”混成一套耦合实现

### 推荐

选择 **方案 B：LiveKit + 本地语音编排服务**。

原因：

- 对现有架构侵入最小
- 能把“媒体层”和“AI 语义层”分离
- 适合你当前要求的 `全部本地私有`
- 后续可平滑扩到真人语音客服、语音转视频接管、移动端统一接入

---

## 推荐技术栈

### 媒体层

- `LiveKit` 自建
  - 负责 1v1 实时音频房间
  - 负责 WebRTC 连接、弱网适配、设备接入、网络穿透

### 实时 STT

- `sherpa-onnx`
  - 作为实时转写主引擎
  - 负责低延迟 partial transcript
  - 用于驱动 UI 中的“正在识别”体验

### 精度补偿

- `FunASR`
  - 作为句末终稿重识别器
  - 用于中文客服场景下的终稿修正
  - 负责标点、术语、句末定稿质量提升

### 领域纠错层

- 自建 `entity-normalizer`
  - 基于规则和词典
  - 规范化以下实体：
    - 手机型号
    - 城市/区域
    - 门店名
    - 售后术语
    - 订单号/手机号等槽位

### TTS

- `sherpa-onnx`
  - 作为本地 TTS 主方案
  - 保持部署统一、离线可运行
- 可选 `Piper`
  - 作为备选语音播报 provider

### 业务/编排层

- `voice-realtime-service`
  - 新增 Python/FastAPI 服务
  - 负责语音会话编排、turn detection、打断、TTS 调度、消息回写

- `ai-service`
  - 继续负责 RAG、workflow、LangGraph、转人工决策
  - 不改现有主文本问答链

---

## 架构设计

### 总体链路

```text
H5 / Flutter 麦克风
-> LiveKit 音频房间
-> voice-realtime-service
-> sherpa-onnx 实时转写
-> FunASR 终稿修正
-> entity-normalizer
-> ai-service (RAG / LangGraph / handoff)
-> sherpa-onnx TTS
-> LiveKit 返回语音给客户端
-> 同步将文本与事件写回 message-gateway / platform-api
```

### 设计原则

1. 语音只是输入输出层，AI 内部仍以文本为主语义层。
2. 语音客服与文本客服共用 `conversation_id`。
3. 所有语音交互都要有文本转写留痕，方便客服接手与审计。
4. 复杂流程仍走现有 `ai-service` 和 LangGraph，不在语音服务里复制业务逻辑。

---

## 新增服务设计

### `services/voice-realtime-service`

职责：

- 维护语音会话生命周期
- 接收 LiveKit 音频房间事件
- 调实时 STT / 终稿修正 / TTS
- 做用户说完判断、AI 回答中断、状态控制
- 把最终文本和系统事件写回现有会话系统

建议模块：

- `app/api/router.py`
- `app/core/config.py`
- `app/session/service.py`
- `app/stt/realtime_sherpa.py`
- `app/stt/final_funasr.py`
- `app/tts/sherpa_tts.py`
- `app/nlu/entity_normalizer.py`
- `app/orchestrator/voice_orchestrator.py`
- `app/events/message_bridge.py`

---

## 状态机设计

语音会话状态建议统一成：

- `idle`
- `connecting`
- `listening`
- `recognizing`
- `thinking`
- `speaking`
- `handoff_pending`
- `human_takeover`
- `ended`
- `error`

关键行为：

- 用户说话时：`listening -> recognizing`
- 识别句末：`recognizing -> thinking`
- AI 开始播报：`thinking -> speaking`
- 用户打断：`speaking -> listening`
- 转人工：`thinking/speaking -> handoff_pending -> human_takeover`

---

## 与现有系统的集成

### 与 `ai-service`

输入：

- 终稿文本
- 当前 `conversation_id`
- 已抽取槽位
- 最近 1~N 轮转写文本

输出：

- `answer`
- `clarify`
- `handoff`
- `reject`
- 流式回复文本片段

### 与 `message-gateway`

新增或复用事件：

- `voice.session.started`
- `voice.transcript.partial`
- `voice.transcript.final`
- `voice.reply.started`
- `voice.reply.finished`
- `voice.handoff`

### 与 `platform-api`

新增模块：

- `voice_session`
- `voice_transcript_segment`
- `voice_audio_asset`
- `voice_handoff_record`

---

## 数据模型建议

### `voice_session`

- `id`
- `conversation_id`
- `channel`
- `status`
- `livekit_room`
- `stt_provider`
- `finalizer_provider`
- `tts_provider`
- `started_at`
- `ended_at`

### `voice_transcript_segment`

- `id`
- `voice_session_id`
- `speaker`
- `text`
- `normalized_text`
- `is_final`
- `start_ms`
- `end_ms`
- `created_at`

### `voice_audio_asset`

- `id`
- `voice_session_id`
- `asset_type` (`input_chunk`, `tts_output`, `full_recording`)
- `file_key`
- `mime_type`
- `duration_ms`
- `created_at`

### `voice_handoff_record`

- `id`
- `voice_session_id`
- `reason`
- `summary`
- `handoff_to`
- `created_at`

---

## 测试策略

### 单元测试

- 实时 STT 适配层
- FunASR 终稿修正适配层
- 实体纠错器
- 会话状态机
- TTS provider

### 集成测试

- voice-realtime-service 与 ai-service
- voice-realtime-service 与 message-gateway
- 语音文本回写
- 转人工与摘要

### 浏览器测试

- H5 麦克风权限
- 实时转写显示
- AI 语音播放
- 用户打断
- 转人工后后台接续

### 评测

- partial transcript latency
- final transcript accuracy
- 业务实体识别准确率
- 首句响应时延
- handoff 正确率

---

## 分阶段实施

### Phase 1：语音基础链路

- H5 麦克风接入
- LiveKit 1v1 音频房间
- sherpa-onnx 实时转写
- 文本回显
- 文本继续走现有 ai-service

### Phase 2：终稿修正与 TTS

- FunASR 终稿修正
- 实体纠错
- sherpa-onnx TTS
- AI 语音播报
- 中断控制

### Phase 3：转人工与审计

- 语音转人工
- 后台接手同一会话
- 录音归档
- 转写留痕
- 语音质检和摘要

---

## 结论

本地私有智能语音客服的最佳方案，不是把一个语音模型硬塞进现有系统，而是新增 `voice-realtime-service`，并采用：

- `LiveKit` 负责实时音频传输
- `sherpa-onnx` 负责实时转写
- `FunASR` 负责终稿修正
- `entity-normalizer` 负责业务实体纠错
- `sherpa-onnx` 负责本地 TTS
- `ai-service` 继续负责文本智能与复杂流程

这样能最大程度复用现有会话、知识库、RAG、LangGraph 和转人工体系，同时满足 `本地私有`、`实时对话` 和 `企业客服可审计` 三个目标。
