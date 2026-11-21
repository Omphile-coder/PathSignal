param([switch]$Commit)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$webRoot = Join-Path $projectRoot 'presentation-site'

# Preview by default. Use -Commit to create local commits. Nothing is pushed.
# Explicit paths keep credentials, private clips, caches and exports out of staging.
$groups = @(
    @{ Repo=$webRoot; Message='feat: enable six electronics classes in the object detector'; Paths=@('src/yoloxDecode.ts','scripts/check-object-classes.mjs','scripts/check-electronics.mjs') },
    @{ Repo=$webRoot; Message='feat: add local YOLOv8 stair inference with verified model chunks'; Paths=@('src/stairDetector.ts','src/stairs.worker.ts','scripts/prepare-model.mjs','source-model/stairs-yolov8n.onnx','source-model/stairs-yolov8n-manifest.json') },
    @{ Repo=$webRoot; Message='feat: connect experimental stair mode to accessible alerts and scan logs'; Paths=@('src/App.tsx','src/useDetector.ts','src/useMonitor.ts') },
    @{ Repo=$webRoot; Message='fix: open the retro web app with an available local port'; Paths=@('scripts/serve.mjs','scripts/check-launcher.mjs') },
    @{ Repo=$webRoot; Message='test: cover stair decoding camera lifecycle and embedded phone detectors'; Paths=@('scripts/check-stairs.mjs','scripts/check-stair-decoder.mjs','scripts/check-stair-failure.mjs','scripts/check-stair-lifecycle.mjs','scripts/check-phone-detector.mjs') },
    @{ Repo=$webRoot; Message='docs: update stair evidence limitations and presentation instructions'; Paths=@('README.md','public/presentation-guide.md','public/project-report.md','public/stair-development-notes.md','public/stair-integration-notes.md','public/technical-notes.md') },
    @{ Repo=$webRoot; Message='docs: publish AGPL notices and the corresponding application source'; Paths=@('.gitignore','LICENSE','public/licenses/AGPL-3.0.txt','public/source.html','public/source','source-model/upstream-ultralytics-v8.2.0.zip') },
    @{ Repo=$webRoot; Message='test: record browser model and deployment verification evidence'; Paths=@('verification/*.json','verification/*.png','verification/*.md') },
    @{ Repo=$projectRoot; Message='feat: add offline experimental stair detection and spoken alerts on iPhone'; Paths=@('phone/App.tsx','phone/useObjectWorker.tsx','phone/stairDetector.ts','phone/worker/detector.ts','phone/worker/build.cjs','phone/assets/stairs.wav','phone/assets/model/detector.html','phone/assets/model/stairs-detector.html','phone/assets/model/stairs-yolov8n.onnx') },
    @{ Repo=$projectRoot; Message='fix: route the main launcher to the retro app and preserve the legacy lab'; Paths=@('Start PathSignal.cmd','Start PathSignal Legacy Lab.cmd','README.md') },
    @{ Repo=$projectRoot; Message='test: add local Roboflow access download and model comparison tools'; Paths=@('Check Roboflow Model Access.cmd','Download Roboflow Models.cmd','model-comparison/.gitignore','model-comparison/README.md','model-comparison/check_access.py','model-comparison/download_models.py','model-comparison/evaluate_models.py','model-comparison/test_access.py','model-comparison/test_download.py','model-comparison/test_evaluation.py','model-comparison/verify_source_package.py') },
    @{ Repo=$projectRoot; Message='docs: add reproducible source packaging and phone setup instructions'; Paths=@('SOURCE-README.md','source-setup.mjs','package_source.py','phone/LICENSE','phone/README.md','Commit PathSignal Changes.ps1') },
    @{ Repo=$projectRoot; Message='chore: update the presentation app submodule reference'; Paths=@('presentation-site') }
)

foreach ($repo in @($webRoot,$projectRoot)) {
    & git -C $repo rev-parse --show-toplevel | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Git repository unavailable: $repo" }
    if ($Commit) {
        & git -C $repo diff --cached --quiet
        if ($LASTEXITCODE -eq 1) { throw "Existing staged changes in $repo. Review and commit or unstage them before running this script." }
        if ($LASTEXITCODE -ne 0) { throw "Could not check staged changes in $repo" }
        & git -C $repo var GIT_AUTHOR_IDENT 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Configure your Git user.name and user.email before committing.' }
    }
}

$created = 0
$number = 0
foreach ($group in $groups) {
    $number++
    $paths = @()
    foreach ($relative in $group.Paths) {
        $fullPath = Join-Path $group.Repo $relative
        if ($relative.Contains('*')) {
            $paths += @(Get-ChildItem -Path $fullPath -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
        } elseif (Test-Path -LiteralPath $fullPath) {
            $paths += $relative
        }
    }
    Write-Host ("{0}. {1}" -f $number,$group.Message) -ForegroundColor Cyan
    Write-Host ("   Repository: {0}; selected paths: {1}" -f (Split-Path $group.Repo -Leaf),$paths.Count)
    if (-not $Commit) { continue }
    if ($paths.Count -eq 0) { Write-Host '   Skipped: files are absent.'; continue }
    & git -C $group.Repo add -- @paths
    if ($LASTEXITCODE -ne 0) { throw "Staging failed for group $number. No further commits attempted." }
    & git -C $group.Repo diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host '   Skipped: no changes in this group.'; continue }
    if ($LASTEXITCODE -ne 1) { throw "Could not check staged changes for group $number" }
    & git -C $group.Repo commit -m $group.Message
    if ($LASTEXITCODE -ne 0) { throw "Commit failed for group $number. Review the staged files before retrying." }
    $created++
}

if ($Commit) {
    Write-Host "Created $created local commits. Nothing was pushed."
    Write-Host 'Other project files may remain uncommitted; review git status in both repositories.'
} else {
    Write-Host "Preview complete: $($groups.Count) commit messages. No files staged or committed."
    Write-Host 'To create these local commits, run this script again with -Commit.'
}
