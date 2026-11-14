import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Khóa ký bản phát hành nằm ngoài git: android/key.properties (đã gitignore) gồm storeFile, storePassword,
// keyAlias, keyPassword. Hướng dẫn tạo khóa ở mobile/README.md, mục "Phát hành Android".
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) FileInputStream(file).use { load(it) }
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "dev.ngoloi.devkuncare"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "dev.ngoloi.devkuncare"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // local_auth 3.x supports Android API 24+. Keeping this explicit makes
        // the production device contract visible instead of relying on a
        // manifest-merger override.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Có key.properties thì ký bằng khóa phát hành. Không có thì ký tạm bằng khóa debug để
            // `flutter run --release` và CI vẫn dựng được; gói AAB đưa lên cửa hàng bị chặn bên dưới.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

// Chặn nhầm đưa lên cửa hàng gói ký bằng khóa debug.
gradle.taskGraph.whenReady {
    if (!hasReleaseKeystore && hasTask(":app:bundleRelease")) {
        throw GradleException(
            "Thiếu android/key.properties: không dựng AAB phát hành bằng khóa debug. " +
                "Xem mobile/README.md, mục Phát hành Android.",
        )
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.1")
}
