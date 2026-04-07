import 'dart:convert';
import 'dart:io';

class PlatformApiException implements Exception {
  const PlatformApiException(this.statusCode, this.message, {this.body});

  final int statusCode;
  final String message;
  final String? body;

  @override
  String toString() => 'PlatformApiException($statusCode, $message)';
}

class PlatformApiClient {
  PlatformApiClient({
    required String baseUrl,
    String? accessToken,
    HttpClient? httpClient,
  })  : _baseUri = Uri.parse(baseUrl.endsWith('/') ? baseUrl : '$baseUrl/'),
        _accessToken = accessToken,
        _httpClient = httpClient ?? HttpClient();

  final Uri _baseUri;
  final HttpClient _httpClient;
  String? _accessToken;

  String? get accessToken => _accessToken;

  void setAccessToken(String? value) {
    _accessToken = value;
  }

  Future<Map<String, dynamic>> getJsonObject(String path) async {
    final result = await request(path);
    if (result is Map<String, dynamic>) {
      return result;
    }
    throw const PlatformApiException(500, 'Expected JSON object response');
  }

  Future<List<dynamic>> getJsonList(String path) async {
    final result = await request(path);
    if (result is List<dynamic>) {
      return result;
    }
    if (result is Map<String, dynamic> && result['items'] is List<dynamic>) {
      return result['items'] as List<dynamic>;
    }
    throw const PlatformApiException(500, 'Expected JSON list response');
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = _baseUri.resolve(path.startsWith('/') ? path.substring(1) : path);
    final request = await _httpClient.openUrl(method, uri);
    request.headers.contentType = ContentType.json;
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    if (_accessToken != null && _accessToken!.isNotEmpty) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $_accessToken');
    }
    if (body != null) {
      request.add(utf8.encode(jsonEncode(body)));
    }

    final response = await request.close();
    final rawBody = await utf8.decoder.bind(response).join();

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == HttpStatus.noContent || rawBody.trim().isEmpty) {
        return null;
      }
      return jsonDecode(rawBody);
    }

    throw PlatformApiException(
      response.statusCode,
      response.reasonPhrase,
      body: rawBody.isEmpty ? null : rawBody,
    );
  }
}
