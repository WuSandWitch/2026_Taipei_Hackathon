import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_handler.dart';

/// Shared text-to-speech engine for web services.
/// Uses the phone's built-in TTS engine (on-device), so no cloud inference.
abstract final class _Tts {
  static final FlutterTts _tts = FlutterTts();
  static Future<void>? _ready;

  static Future<void> _init() async {
    await _tts.setLanguage('zh-TW');
    // flutter_tts scale: 0.5 is normal speed on both iOS and Android.
    await _tts.setSpeechRate(0.5);
    await _tts.awaitSpeakCompletion(false);
    if (Platform.isIOS) {
      try {
        // Keep speaking even when the ring/silent switch is set to silent.
        await _tts.setIosAudioCategory(
          IosTextToSpeechAudioCategory.playback,
          [
            IosTextToSpeechAudioCategoryOptions.duckOthers,
            IosTextToSpeechAudioCategoryOptions.mixWithOthers,
          ],
        );
      } catch (error) {
        debugPrint('tts ios audio category: $error');
      }
    }
  }

  static Future<FlutterTts> get instance async {
    _ready ??= _init();
    await _ready;
    return _tts;
  }
}

/// `tts_speak` — data: `{ text: String, probe?: bool }`
/// Replies `true` when speech started. With `probe: true` it only replies `true`,
/// so the web page can detect that native TTS is available.
class TtsSpeakMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'tts_speak';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  }) async {
    final Map<dynamic, dynamic> data = message is Map ? message : const {};
    if (data['probe'] == true) {
      onReply?.call(replyWebMessage(data: true));
      return;
    }
    final Object? rawText = data['text'];
    final String text = rawText is String ? rawText.trim() : '';
    if (text.isEmpty) {
      onReply?.call(replyWebMessage(data: false));
      return;
    }
    try {
      final FlutterTts tts = await _Tts.instance;
      await tts.stop();
      final dynamic result = await tts.speak(text);
      onReply?.call(replyWebMessage(data: result == 1));
    } catch (error) {
      debugPrint('tts_speak: $error');
      onReply?.call(replyWebMessage(data: false));
    }
  }
}

/// `tts_stop` — stops any speech in progress.
class TtsStopMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'tts_stop';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  }) async {
    try {
      final FlutterTts tts = await _Tts.instance;
      await tts.stop();
    } catch (error) {
      debugPrint('tts_stop: $error');
    }
  }
}

/// `vibrate` — data: `{ pattern: [on, off, on, ...] }` in milliseconds.
/// Built on HapticFeedback (no extra package or permission). A newer pattern
/// cancels one still playing.
class VibrateMessageHandler extends TPWebMessageHandler {
  static int _generation = 0;
  static const int _maxTotalMs = 6000;

  @override
  String get name => 'vibrate';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  }) async {
    final Map<dynamic, dynamic> data = message is Map ? message : const {};
    final Object? rawPattern = data['pattern'];
    final List<int> pattern = rawPattern is List
        ? rawPattern.whereType<num>().map((n) => n.toInt().clamp(0, 2000).toInt()).toList()
        : <int>[200];
    if (pattern.isEmpty) return;

    final int generation = ++_generation;
    int total = 0;
    for (int i = 0; i < pattern.length && total < _maxTotalMs; i++) {
      if (generation != _generation) return;
      final int ms = pattern[i];
      total += ms;
      if (i.isEven) {
        await _buzz(ms, generation);
      } else {
        await Future<void>.delayed(Duration(milliseconds: ms));
      }
    }
  }

  static Future<void> _buzz(int ms, int generation) async {
    final DateTime end = DateTime.now().add(Duration(milliseconds: ms));
    do {
      if (generation != _generation) return;
      if (Platform.isIOS) {
        await HapticFeedback.heavyImpact();
      } else {
        await HapticFeedback.vibrate();
      }
      await Future<void>.delayed(const Duration(milliseconds: 90));
    } while (DateTime.now().isBefore(end));
  }
}
