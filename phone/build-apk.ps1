param([string]$JavaHome = $env:JAVA_HOME)

$ErrorActionPreference = 'Stop'
if ($JavaHome) { $env:JAVA_HOME = $JavaHome }
$java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin\java.exe' } else { 'java.exe' }
if ($env:JAVA_HOME -and !(Test-Path -LiteralPath $java)) {
    throw "JAVA_HOME does not point to a JDK: $env:JAVA_HOME"
}
$javaVersion = & cmd.exe /d /c "`"$java`" -version 2>&1" | Out-String
if ($LASTEXITCODE -ne 0 -or $javaVersion -notmatch 'version "(1[7-9]|2[0-5])[\.]') {
    throw 'Set JAVA_HOME to JDK 17 before building.'
}
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (!(Test-Path -LiteralPath $sdk)) { throw "Android SDK not found: $sdk" }
$env:ANDROID_HOME = $sdk
Push-Location -LiteralPath $PSScriptRoot
try {
    foreach ($name in @('objects.onnx','depth.onnx')) {
        if (!(Test-Path -LiteralPath (Join-Path 'assets/model/dual' $name) -PathType Leaf)) {
            throw "Missing bundled model: $name"
        }
    }
    npm.cmd run build:detector -- dual
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if (!(Test-Path -LiteralPath 'android\gradlew.bat')) {
        npx.cmd expo prebuild --platform android --no-install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    # Keep native object names within the Windows limit when Ninja builds codegen.
    $appGradle = Join-Path $PWD 'android\app\build.gradle'
    $gradleSource = [IO.File]::ReadAllText($appGradle)
    if ($gradleSource.Contains('-DCMAKE_OBJECT_PATH_MAX=180')) {
        $gradleSource = $gradleSource.Replace('-DCMAKE_OBJECT_PATH_MAX=180', '-DCMAKE_OBJECT_PATH_MAX=250')
        [IO.File]::WriteAllText($appGradle, $gradleSource)
    }
    if (!$gradleSource.Contains('-DCMAKE_OBJECT_PATH_MAX=250')) {
        $defaultConfig = [regex]::new('(?m)^    defaultConfig \{')
        if ($defaultConfig.Matches($gradleSource).Count -ne 1) {
            throw 'Cannot find the Android defaultConfig block for the Windows CMake setting.'
        }
        $cmakeConfig = @"
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments '-DCMAKE_OBJECT_PATH_MAX=250'
            }
        }
"@
        [IO.File]::WriteAllText($appGradle, $defaultConfig.Replace($gradleSource, $cmakeConfig, 1))
    }
    Push-Location 'android'
    try {
        .\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a'
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally { Pop-Location }
    Get-ChildItem -LiteralPath 'android\app\build\outputs\apk\release' -Filter '*.apk' |
        Select-Object -ExpandProperty FullName
} finally { Pop-Location }
