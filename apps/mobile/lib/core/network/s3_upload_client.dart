import 'package:dio/dio.dart';

/// Dio instance for direct PUTs to a presigned S3 URL.
///
/// Deliberately NOT [ApiClient]: its interceptor attaches a FORGE API bearer
/// token, which S3's presigned-URL signature validation does not expect and
/// would reject. This also can't reuse [applyCertificatePinning] — that pins
/// the FORGE API's CA specifically, and S3 uses a different certificate
/// chain, so applying it here would break every upload once pinning is
/// enabled. A plain, unauthenticated Dio is the correct client for this host.
///
/// Centralized so upload call sites go through `core/network` (per
/// forge-mobile.md) instead of each constructing its own bare `Dio()`.
Dio createS3UploadDio() => Dio();
