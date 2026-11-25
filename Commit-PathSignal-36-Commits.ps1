param(
    [switch]$CommitAndPush,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# Preview is the default. This script creates 36 small, reviewable commits for
# the current phone monitor, bundled models, Android release project, and the
# presentation-site submodule pointer. Nothing is staged or committed unless
# -CommitAndPush is supplied.
$groups = @(
    @{ Message='feat: make the closest-hazard monitor the phone home screen'; Paths=@('phone/ClosestHazardMonitor.tsx') },
    @{ Message='feat: add corridor-aware nearest hazard selection'; Paths=@('phone/nearestHazard.ts') },
    @{ Message='feat: add calibrated distance feedback zones'; Paths=@('phone/proximityFeedback.ts') },
    @{ Message='feat: play directional beeps and Android vibration pulses'; Paths=@('phone/useProximityFeedback.ts') },
    @{ Message='feat: persist phone distance calibration'; Paths=@('phone/distanceCalibration.ts') },
    @{ Message='feat: detect frontal wall distance from monocular depth'; Paths=@('phone/wallDistance.ts') },
    @{ Message='feat: connect obstacle scanning to the phone workflow'; Paths=@('phone/obstacleScan.ts') },
    @{ Message='build: load bundled dual detector assets offline'; Paths=@('phone/bundledDetector.ts') },
    @{ Message='chore: add automatic model preparation helper'; Paths=@('phone/worker/prepare-automatic-models.py') },
    @{ Message='feat: update the detector worker result pipeline'; Paths=@('phone/worker/detector.ts') },
    @{ Message='build: bundle the dual detector worker'; Paths=@('phone/worker/build.cjs') },
    @{ Message='feat: improve ROD object decoding for phone hazards'; Paths=@('phone/rodDetector.ts') },
    @{ Message='fix: connect object worker lifecycle to camera scans'; Paths=@('phone/useObjectWorker.tsx') },
    @{ Message='fix: preserve phone scan controls and alert status'; Paths=@('phone/App.tsx') },
    @{ Message='chore: update phone runtime dependencies'; Paths=@('phone/package.json') },
    @{ Message='build: configure the phone entry point'; Paths=@('phone/index.js') },
    @{ Message='build: configure Metro for offline detector assets'; Paths=@('phone/metro.config.js') },
    @{ Message='chore: configure PathSignal Android and iOS metadata'; Paths=@('phone/app.json') },
    @{ Message='chore: align phone TypeScript settings'; Paths=@('phone/tsconfig.json') },
    @{ Message='chore: ignore generated phone build files'; Paths=@('phone/.gitignore') },
    @{ Message='assets: add directional pulse audio clips'; Paths=@('phone/assets/pulses/*') },
    @{ Message='assets: add retro phone monitor artwork'; Paths=@('phone/assets/retro/*') },
    @{ Message='model: bundle the automatic detector runtime page'; Paths=@('phone/assets/model/automatic-detector.html') },
    @{ Message='model: add the automatic paving checkpoint'; Paths=@('phone/assets/model/automatic-paving-crop.onnx') },
    @{ Message='model: add the automatic object checkpoint'; Paths=@('phone/assets/model/automatic-yolox-480.onnx') },
    @{ Message='android: add the release application sources'; Paths=@('phone/android/app/src/main/java/com/pathsignal/depthlab/*') },
    @{ Message='android: add the release manifest'; Paths=@('phone/android/app/src/main/AndroidManifest.xml') },
    @{ Message='android: add release application resources'; Paths=@('phone/android/app/src/main/res/**/*') },
    @{ Message='android: add debug manifest configuration'; Paths=@('phone/android/app/src/debug/*','phone/android/app/src/debugOptimized/*') },
    @{ Message='android: configure the release app module'; Paths=@('phone/android/app/build.gradle','phone/android/app/proguard-rules.pro') },
    @{ Message='android: configure the Gradle project'; Paths=@('phone/android/build.gradle','phone/android/settings.gradle','phone/android/gradle.properties') },
    @{ Message='android: add the Gradle wrapper'; Paths=@('phone/android/gradle/*','phone/android/gradlew','phone/android/gradlew.bat') },
    @{ Message='android: include the local release signing key'; Paths=@('phone/android/app/debug.keystore') },
    @{ Message='chore: add VS Code project settings'; Paths=@('.vscode/*') },
    @{ Message='chore: update the presentation-site submodule reference'; Paths=@('presentation-site') },
    @{ Message='chore: add the 36-commit PathSignal push script'; Paths=@('Commit-PathSignal-36-Commits.ps1') }
)

if ($groups.Count -ne 36) { throw "Expected 36 commit groups, found $($groups.Count)." }

function Invoke-Git([string[]]$Arguments, [string]$Failure) {
    & git -C $root @Arguments
    if ($LASTEXITCODE -ne 0) { throw $Failure }
}

Invoke-Git @('rev-parse','--show-toplevel') "Git repository unavailable: $root"
$branch = (& git -C $root branch --show-current).Trim()
if (-not $branch) { throw 'The repository is in detached HEAD state. Switch to your working branch first.' }
if ((& git -C $root remote) -notcontains 'origin') { throw 'The origin remote is missing.' }

& git -C $root diff --cached --quiet
if ($LASTEXITCODE -eq 1) { throw 'There are already staged changes. Review or unstage them before running this script.' }
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect staged changes.' }

function Get-ExistingPaths([string[]]$Patterns) {
    $found = @()
    foreach ($pattern in $Patterns) {
        $full = Join-Path $root $pattern
        if ($pattern.Contains('*')) {
            $matches = @(Get-ChildItem -Path $full -File -ErrorAction SilentlyContinue)
            if ($matches.Count -gt 0) { $found += $pattern }
        } elseif (Test-Path -LiteralPath $full) {
            $found += $pattern
        }
    }
    return @($found)
}

foreach ($group in $groups) {
    $existing = Get-ExistingPaths $group.Paths
    if ($existing.Count -eq 0) { throw "No existing paths for: $($group.Message)" }
    $changes = & git -C $root status --porcelain -- $existing
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect: $($group.Message)" }
    if (-not $changes) { throw "No uncommitted changes for: $($group.Message)" }
}

for ($number = 0; $number -lt $groups.Count; $number++) {
    $group = $groups[$number]
    $existing = Get-ExistingPaths $group.Paths
    Write-Host ("{0,2}. {1}" -f ($number + 1), $group.Message) -ForegroundColor Cyan
    Write-Host ("    {0} path pattern(s)" -f $existing.Count)
    if (-not $CommitAndPush) { continue }
    Invoke-Git (@('add','--') + $existing) "Could not stage commit $($number + 1)."
    Invoke-Git @('commit','-m',$group.Message) "Commit $($number + 1) failed. Review git status before retrying."
}

if ($CheckOnly) {
    Write-Host 'Preflight passed for all 36 commits. Nothing was staged, committed or pushed.' -ForegroundColor Green
    exit 0
}

if (-not $CommitAndPush) {
    Write-Host 'Preview only: nothing was staged, committed or pushed.'
    Write-Host 'Run .\Commit-PathSignal-36-Commits.ps1 -CheckOnly to validate every path.'
    Write-Host 'Run .\Commit-PathSignal-36-Commits.ps1 -CommitAndPush to create and push the 36 commits.'
    exit 0
}

Invoke-Git @('push','origin',$branch) "Push failed for branch '$branch'. Review git status before retrying."
Write-Host "Created and pushed 36 commits on '$branch'." -ForegroundColor Green
