# mobile-flutter

Flutter mobile client for the `Leke Service Console` platform.

## Scope

- `login` page with real auth call
- `home` page with dashboard snapshot
- `chat` page with conversation summary, transfer, end, satisfaction, and leave-message entry
- `history` page with conversation history and summary drill-in
- `profile` page with session info, permissions, recent leave messages, and quick留言
- shared API/client/repository/state layer under `lib/core/platform`

## Runtime configuration

Pass backend endpoints with `dart-define` when running the app:

```bash
flutter run \
  --dart-define=PLATFORM_API_BASE_URL=http://localhost:8000 \
  --dart-define=MESSAGE_GATEWAY_HTTP_BASE_URL=http://localhost:8010 \
  --dart-define=MESSAGE_GATEWAY_WS_BASE_URL=ws://localhost:8010/ws
```

Defaults:

- `PLATFORM_API_BASE_URL=http://localhost:8000`
- `MESSAGE_GATEWAY_HTTP_BASE_URL=http://localhost:8010`
- `MESSAGE_GATEWAY_WS_BASE_URL=ws://localhost:8010/ws`

## Android package identity

- `namespace`: `com.leke.serviceconsole`
- `applicationId`: `com.leke.serviceconsole`
- app label: `Leke Service Console`

这套命名与当前产品控制台命名保持一致。若后续需要区分测试/生产包，可在 flavor 层追加后缀，而不是再改基础包名。

## Android release signing

`android/app/build.gradle.kts` 现在支持两种模式：

- 如果存在 `android/keystore.properties`，则使用正式 release keystore
- 如果不存在，则自动降级为 debug signing，方便本机构建验证

`android/keystore.properties` 示例：

```properties
storeFile=../keystore/release.jks
storePassword=your-store-password
keyAlias=release
keyPassword=your-key-password
```

## Local verification

在本机已完成：

- `flutter pub get`
- `flutter analyze`
- `flutter test`
- `flutter test integration_test`
- `flutter build ios --simulator --debug --no-codesign`

如果 `flutter` 不在 PATH，可以直接指定：

```bash
FLUTTER_BIN=/Users/west/dev/env/flutter/bin/flutter bash ../../scripts/verify-mobile-flutter.sh
```

Android 构建验证建议：

- `pnpm mobile:android:doctor`
- `pnpm mobile:android:doctor:fix`
- `pnpm mobile:android:build:debug`
- `pnpm mobile:android:build:release`

也可以直接调用 Flutter：

```bash
flutter build apk --debug
flutter build apk --release
```

`doctor` 会检查：

- `flutter` 是否可用
- `java` 是否可用
- `android/local.properties` 或 `ANDROID_SDK_ROOT`
- `sdkmanager` 是否可用
- `ndk/28.2.13676358/source.properties` 是否存在
- 是否有损坏的 NDK 目录

如果本机 NDK 损坏或缺失，可以直接执行：

```bash
pnpm mobile:android:doctor:fix
pnpm mobile:android:build:debug
```

当前已验证：

- `pnpm test:mobile-flutter`
- `pnpm mobile:android:doctor`
- `bash scripts/mobile-flutter-android-build.sh debug`

## Notes

- The current client uses an in-memory app controller and repository abstraction.
- Authentication is session-scoped in memory; persistent token storage can be added later.
- All network calls go through `PlatformApiClient`, so API contract changes should be isolated there first.
