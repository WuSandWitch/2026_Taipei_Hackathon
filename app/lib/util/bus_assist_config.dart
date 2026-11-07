/// 「公車陪你搭」微服務設定。
///
/// 開發時用 --dart-define 指向本機的 Vite dev server（frontend/ 執行 npm run dev）：
///   iOS 模擬器：     flutter run --dart-define=BUS_ASSIST_URL=http://localhost:5173/
///   Android 模擬器： flutter run --dart-define=BUS_ASSIST_URL=http://10.0.2.2:5173/
///   實機（同一個 Wi-Fi）：flutter run --dart-define=BUS_ASSIST_URL=http://<電腦IP>:5173/
/// 部署到 Firebase Hosting 後，把 defaultValue 改成正式的 HTTPS 網址。
abstract final class BusAssistConfig {
  static const String url = String.fromEnvironment(
    'BUS_ASSIST_URL',
    defaultValue: 'https://bus-assist-2026.web.app/',
  );

  static const String title = '公車陪你搭';
}
