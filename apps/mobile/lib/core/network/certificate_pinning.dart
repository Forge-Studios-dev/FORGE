import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';

import '../constants/app_constants.dart';

/// TLS certificate pinning for the production API host (HIGH-06).
///
/// Off by default — pass `--dart-define=CERT_PINNING_ENABLED=true` once this
/// has been verified against a real device build. A wrong pin fails closed
/// (every API call breaks for every user), so this should only flip on for
/// the real production build after a staging/TestFlight build has confirmed
/// it actually connects.
///
/// Implementation note: `HttpClient.badCertificateCallback` is NOT real
/// pinning on its own — Dart only invokes it when the OS's default
/// trust-store validation *fails*. A rogue CA installed in the device's
/// trust store (the actual MITM threat this defends against, e.g. a
/// corporate proxy or a socially-engineered profile) presents a
/// certificate that passes normal validation, so that callback would never
/// even fire. Instead this uses an isolated [SecurityContext] that trusts
/// *only* the pinned CA below, so every connection is forced through it
/// regardless of what the OS trust store says.
///
/// ROTATION RUNBOOK — this pins the issuing intermediate (far more stable
/// than the leaf, which Let's Encrypt rotates every ~60-90 days). If
/// validation starts rejecting real API traffic, or ahead of a known CA
/// migration, fetch the current chain and replace `_pinnedCaPem` with the
/// new intermediate (the cert that *issued* the leaf, not the leaf itself):
///   openssl s_client -connect api.forgestudios.net:443 \
///     -servername api.forgestudios.net -showcerts </dev/null 2>/dev/null \
///     | awk '/BEGIN CERT/,/END CERT/{print > ("/tmp/cert" n ".pem")} /END CERT/{n++}'
///   cat /tmp/cert1.pem   # the intermediate — paste its contents below
const _pinnedCaPem = '''
-----BEGIN CERTIFICATE-----
MIIEVjCCAj6gAwIBAgIQY5WTY8JOcIJxWRi/w9ftVjANBgkqhkiG9w0BAQsFADBP
MQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFy
Y2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMTAeFw0yNDAzMTMwMDAwMDBa
Fw0yNzAzMTIyMzU5NTlaMDIxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBF
bmNyeXB0MQswCQYDVQQDEwJFODB2MBAGByqGSM49AgEGBSuBBAAiA2IABNFl8l7c
S7QMApzSsvru6WyrOq44ofTUOTIzxULUzDMMNMchIJBwXOhiLxxxs0LXeb5GDcHb
R6EToMffgSZjO9SNHfY9gjMy9vQr5/WWOrQTZxh7az6NSNnq3u2ubT6HTKOB+DCB
9TAOBgNVHQ8BAf8EBAMCAYYwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsGAQUFBwMB
MBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFI8NE6L2Ln7RUGwzGDhdWY4j
cpHKMB8GA1UdIwQYMBaAFHm0WeZ7tuXkAXOACIjIGlj26ZtuMDIGCCsGAQUFBwEB
BCYwJDAiBggrBgEFBQcwAoYWaHR0cDovL3gxLmkubGVuY3Iub3JnLzATBgNVHSAE
DDAKMAgGBmeBDAECATAnBgNVHR8EIDAeMBygGqAYhhZodHRwOi8veDEuYy5sZW5j
ci5vcmcvMA0GCSqGSIb3DQEBCwUAA4ICAQBnE0hGINKsCYWi0Xx1ygxD5qihEjZ0
RI3tTZz1wuATH3ZwYPIp97kWEayanD1j0cDhIYzy4CkDo2jB8D5t0a6zZWzlr98d
AQFNh8uKJkIHdLShy+nUyeZxc5bNeMp1Lu0gSzE4McqfmNMvIpeiwWSYO9w82Ob8
otvXcO2JUYi3svHIWRm3+707DUbL51XMcY2iZdlCq4Wa9nbuk3WTU4gr6LY8MzVA
aDQG2+4U3eJ6qUF10bBnR1uuVyDYs9RhrwucRVnfuDj29CMLTsplM5f5wSV5hUpm
Uwp/vV7M4w4aGunt74koX71n4EdagCsL/Yk5+mAQU0+tue0JOfAV/R6t1k+Xk9s2
HMQFeoxppfzAVC04FdG9M+AC2JWxmFSt6BCuh3CEey3fE52Qrj9YM75rtvIjsm/1
Hl+u//Wqxnu1ZQ4jpa+VpuZiGOlWrqSP9eogdOhCGisnyewWJwRQOqK16wiGyZeR
xs/Bekw65vwSIaVkBruPiTfMOo0Zh4gVa8/qJgMbJbyrwwG97z/PRgmLKCDl8z3d
tA0Z7qq7fta0Gl24uyuB05dqI5J1LvAzKuWdIjT1tP8qCoxSE/xpix8hX2dt3h+/
jujUgFPFZ0EVZ0xSyBNRF3MboGZnYXFUxpNjTWPKpagDHJQmqrAcDmWJnMsFY3jS
u1igv3OefnWjSQ==
-----END CERTIFICATE-----
''';

/// Applies pinning to [dio]'s underlying HTTP client. No-op unless explicitly
/// enabled, in debug builds, and for any non-https base URL (local dev hits
/// plain http://localhost).
void applyCertificatePinning(Dio dio) {
  const enabled = bool.fromEnvironment('CERT_PINNING_ENABLED');
  if (!enabled || kDebugMode) return;

  final baseUri = Uri.tryParse(AppConstants.apiBaseUrl);
  if (baseUri == null || baseUri.scheme != 'https') return;

  final adapter = dio.httpClientAdapter;
  if (adapter is! IOHttpClientAdapter) return;

  adapter.createHttpClient = () {
    final context = SecurityContext(withTrustedRoots: false)
      ..setTrustedCertificatesBytes(utf8.encode(_pinnedCaPem));
    return HttpClient(context: context);
  };
}
