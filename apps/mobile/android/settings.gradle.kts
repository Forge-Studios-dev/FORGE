pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    // Pinned below flutter create's 9.0.1 default: AGP 9 requires migrating
    // every plugin to "Built-in Kotlin", and several plugins in this app
    // (connectivity_plus, device_info_plus, flutter_webrtc, livekit_client,
    // package_info_plus, share_plus, wakelock_plus) still apply the old
    // standalone Kotlin plugin, which AGP 9 refuses outright. AGP 8.9 keeps
    // the old (pre-built-in-Kotlin) behavior these plugins expect.
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
}

include(":app")
