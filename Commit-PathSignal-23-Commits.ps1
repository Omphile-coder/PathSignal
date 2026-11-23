param([switch]$CommitAndPush, [switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$site = Join-Path $root 'presentation-site'

# Exactly 23 commit messages. Preview by default. Run with -CommitAndPush to create the commits and push both
# GitHub repositories. Paths are explicit; temporary Office lock files are excluded.
$groups = @(
    @{ Repo=$site; Branch='main'; Message='feat: speak the two highest-confidence obstacle labels'; Paths=@('src/useMonitor.ts') },
    @{ Repo=$root; Branch='development'; Message='feat: add YOLOv8 ROD preprocessing and output decoding'; Paths=@('phone/rodDetector.ts') },
    @{ Repo=$root; Branch='development'; Message='chore: add trained ROD ONNX weights for the phone'; Paths=@('phone/assets/model/rod-yolov8n.onnx') },
    @{ Repo=$root; Branch='development'; Message='build: bundle the object, stairs and ROD offline detector pages'; Paths=@('phone/assets/model/detector.html','phone/assets/model/stairs-detector.html','phone/assets/model/rod-detector.html') },
    @{ Repo=$root; Branch='development'; Message='feat: connect ROD inference and corridor filtering in the worker'; Paths=@('phone/worker/detector.ts') },
    @{ Repo=$root; Branch='development'; Message='build: include the ROD profile in the detector bundler'; Paths=@('phone/worker/build.cjs') },
    @{ Repo=$root; Branch='development'; Message='feat: load the selected offline model in the phone app'; Paths=@('phone/useObjectWorker.tsx') },
    @{ Repo=$root; Branch='development'; Message='feat: add phone corridor overlay and confidence-ranked spoken labels'; Paths=@('phone/App.tsx') },
    @{ Repo=$root; Branch='development'; Message='docs: explain ROD mode and shared phone alert behavior'; Paths=@('phone/README.md') },
    @{ Repo=$root; Branch='development'; Message='fix: correct targeted model evaluation handling'; Paths=@('training-lab/evaluate_targeted.py') },
    @{ Repo=$root; Branch='development'; Message='fix: verify targeted ONNX outputs before reporting'; Paths=@('training-lab/verify_targeted_onnx.py') },
    @{ Repo=$root; Branch='development'; Message='docs: report corrected targeted model results'; Paths=@('training-lab/CORRECTED-MODEL-RESULTS.md') },
    @{ Repo=$root; Branch='development'; Message='chore: add reproducible corrected results report builder'; Paths=@('training-lab/build_corrected_report.py','training-lab/corrected-model-decisions.json') },
    @{ Repo=$root; Branch='development'; Message='chore: refresh corrected stair and missing-tile status'; Paths=@('training-lab/stairs-v1-corrected-status.json','training-lab/missing-tile-v2-corrected-status.json') },
    @{ Repo=$root; Branch='development'; Message='feat: add the Kaggle ROD training notebook'; Paths=@('training-lab/Kaggle-ROD-Train.ipynb') },
    @{ Repo=$root; Branch='development'; Message='data: audit the ROD dataset classes and split contents'; Paths=@('training-lab/audit_rod_dataset.py','training-lab/dataset-research/2026-11-23/rod-audit.json') },
    @{ Repo=$root; Branch='development'; Message='data: add Kaggle and Hugging Face ROD download helpers'; Paths=@('training-lab/download_rod_dataset.py','training-lab/download_rod_kaggle.py','training-lab/requirements-dataset-download.txt') },
    @{ Repo=$root; Branch='development'; Message='data: prepare ROD images and labels for training'; Paths=@('training-lab/prepare_rod_detection.py') },
    @{ Repo=$root; Branch='development'; Message='train: add the reproducible ROD detector training entry point'; Paths=@('training-lab/train_rod_detector.py') },
    @{ Repo=$root; Branch='development'; Message='docs: record ROD source review and class limitations'; Paths=@('training-lab/ROD-SOURCE-REVIEW.md') },
    @{ Repo=$root; Branch='development'; Message='docs: update the final-year project presentation'; Paths=@('PathSignal * Final Year Project.pptx') },
    @{ Repo=$root; Branch='development'; Message='chore: add the PathSignal 23-commit push script'; Paths=@('Commit-PathSignal-23-Commits.ps1') },
    @{ Repo=$root; Branch='development'; Message='chore: update the presentation-site submodule reference'; Paths=@('presentation-site') }
)

if ($groups.Count -ne 23) { throw "This script must contain exactly 23 commit messages; found $($groups.Count)." }

function Invoke-Git([string]$Repository, [string[]]$Arguments, [string]$Failure) {
    & git -C $Repository @Arguments
    if ($LASTEXITCODE -ne 0) { throw $Failure }
}

foreach ($repository in @($site, $root)) {
    Invoke-Git $repository @('rev-parse','--show-toplevel') "Git repository unavailable: $repository"
    $branch = (& git -C $repository branch --show-current).Trim()
    $expected = if ($repository -eq $site) { 'main' } else { 'development' }
    if ($branch -ne $expected) { throw "Expected branch '$expected' in $repository, found '$branch'. Switch branches and rerun." }
    $remote = (& git -C $repository remote)
    if ($remote -notcontains 'origin') { throw "The origin remote is missing in $repository." }
    & git -C $repository diff --cached --quiet
    if ($LASTEXITCODE -eq 1) { throw "There are already staged changes in $repository. Review or unstage them first." }
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect staged changes in $repository." }
    if ($CommitAndPush) {
        & git -C $repository var GIT_AUTHOR_IDENT 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Configure git user.name and user.email before committing.' }
    }
}

if ($CommitAndPush -or $CheckOnly) {
    foreach ($group in $groups) {
        $existing = @()
        foreach ($path in $group.Paths) {
            if ($path.Contains('*')) {
                if (Get-ChildItem -Path (Join-Path $group.Repo $path) -File -ErrorAction SilentlyContinue) { $existing += $path }
            } elseif (Test-Path -LiteralPath (Join-Path $group.Repo $path)) { $existing += $path }
        }
        if ($existing.Count -eq 0) { throw "Commit message has no existing paths: $($group.Message)" }
        $changes = & git -C $group.Repo status --porcelain -- @existing
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect paths for: $($group.Message)" }
        if (-not $changes) { throw "No uncommitted changes for: $($group.Message). Nothing has been committed yet." }
    }
}

if ($CheckOnly) {
    Write-Host 'Preflight passed for all 23 commit groups. Nothing was staged, committed or pushed.' -ForegroundColor Green
    exit 0
}

$count = 0
$previewNumber = 0
foreach ($group in $groups) {
    $previewNumber++
    $selected = @()
    foreach ($path in $group.Paths) {
        $full = Join-Path $group.Repo $path
        if ($path.Contains('*')) {
            if (Get-ChildItem -Path $full -File -ErrorAction SilentlyContinue) { $selected += $path }
        } elseif (Test-Path -LiteralPath $full) { $selected += $path }
    }
    Write-Host ("{0,2}. {1}" -f $previewNumber, $group.Message) -ForegroundColor Cyan
    Write-Host ("    {0} - {1} path(s)" -f (Split-Path $group.Repo -Leaf), $selected.Count)
    if (-not $CommitAndPush -or $selected.Count -eq 0) { continue }

    Invoke-Git $group.Repo (@('add','--') + $selected) "Could not stage commit group $previewNumber."
    & git -C $group.Repo diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host '    Skipped: no changes in this group.'; continue }
    if ($LASTEXITCODE -ne 1) { throw "Could not inspect staged commit group $previewNumber." }
    Invoke-Git $group.Repo @('commit','-m',$group.Message) "Commit group $previewNumber failed. Review git status before retrying."
    $count++
}

if (-not $CommitAndPush) {
    Write-Host "Preview only: $($groups.Count) commit messages listed; nothing staged or committed."
    Write-Host 'Run .\Commit-PathSignal-23-Commits.ps1 -CheckOnly to check all paths first.'
    Write-Host 'Run .\Commit-PathSignal-23-Commits.ps1 -CommitAndPush to create commits and push.'
    exit 0
}

if ($count -ne 23) { throw "Created $count commits instead of 23. Nothing was pushed. Review git status." }
Write-Host "Created $count commits. Pushing the presentation site first, then PathSignal..." -ForegroundColor Green
Invoke-Git $site @('push','origin','main') 'Presentation-site push failed; PathSignal was not pushed.'
Invoke-Git $root @('push','origin','development') 'PathSignal push failed. The presentation-site push may already have succeeded.'
Write-Host 'Both repositories were pushed successfully.' -ForegroundColor Green
