param([switch]$Commit)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$labRoot = Join-Path $projectRoot 'training-lab'
$projectUri = [Uri](([System.IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'))

function Convert-ToRepoPath([string]$FullPath) {
    $absolute = [Uri]([System.IO.Path]::GetFullPath($FullPath))
    $relative = [Uri]::UnescapeDataString($projectUri.MakeRelativeUri($absolute).ToString())
    return $relative.Replace('/','\')
}

# Preview by default. Run with -Commit to make local commits only.
# This script never pushes. Dataset ZIPs, extracted images, model weights,
# logs, caches, videos and private Roboflow material are deliberately excluded.
$groups = @(
    @{ Message='docs: add targeted stair and missing paver training overview'; Paths=@('README.md','SECOND-ROUND.md','RESULTS.md','ATTRIBUTION.md') },
    @{ Message='chore: ignore generated training data and model weights'; Paths=@('.gitignore') },
    @{ Message='feat: audit targeted dataset labels and image duplicates'; Paths=@('audit_targeted_archive.py') },
    @{ Message='feat: prepare group separated targeted training datasets'; Paths=@('prepare_targeted.py','verify_targeted_data.py') },
    @{ Message='docs: record targeted model confidence and evaluation policy'; Paths=@('targeted-policy.json','evaluation-policy.json','MODEL-CONTRACTS.md') },
    @{ Message='feat: add reproducible CPU training for targeted detectors'; Paths=@('train_targeted.py') },
    @{ Message='feat: add fixed threshold evaluation for local hazard clips'; Paths=@('evaluate_targeted.py','evaluate_pothole.py','evaluate_stair_gate.py') },
    @{ Message='test: check targeted detector input and output decoding'; Paths=@('targetedDetector.ts','check_targeted_decoder.mjs','targeted-decoder-check.json') },
    @{ Message='feat: prepare browser checks for exported ONNX candidates'; Paths=@('browser-targeted.ts','build_targeted_browser.mjs','serve_targeted_browser.mjs','verify_targeted_onnx.py') },
    @{ Message='docs: add second round training and attribution notes'; Paths=@('SECOND-ROUND.md','README.md','MODEL-CONTRACTS.md') },
    @{ Message='chore: record prepared dataset hashes and provenance'; Paths=@('targeted-provenance.json','dataset-research/2026-11-23/prepared-data-check.json','dataset-research/2026-11-23/download-and-audit-results.json') },
    @{ Message='docs: report targeted model evaluation and integration decisions'; Paths=@('TARGETED-RESULTS.md','targeted-decisions.json','build_targeted_report.py') },
    @{ Message='feat: add first round dataset split and duplicate audits'; Paths=@('audit_datasets.py','prepare_datasets.py','prepare_local_evaluation.py') },
    @{ Message='feat: evaluate stair direction and existing detector candidates'; Paths=@('evaluate_existing_direction.py','evaluate_stair_gate.py') },
    @{ Message='feat: train first round stair direction classifier'; Paths=@('train_direction.py','verify_direction_onnx.py') },
    @{ Message='feat: train and evaluate first round pothole candidate'; Paths=@('train_pothole.py','evaluate_pothole.py') },
    @{ Message='docs: record original model decisions and measured limitations'; Paths=@('decisions.json','RESULTS.md','MODEL-CONTRACTS.md') },
    @{ Message='chore: record model provenance and reproducible dependency versions'; Paths=@('run-provenance.json','input-hash-check.json','model-artifacts.json','requirements-lock.txt') },
    @{ Message='docs: document dataset sources and licensing attribution'; Paths=@('ATTRIBUTION.md','dataset-research/2026-11-23/REVIEW.md','dataset-research/2026-11-23/selected-datasets.json') },
    @{ Message='feat: add public dataset inspection and duplicate review tools'; Paths=@('dataset-research/2026-11-23/fetch_pages.py','dataset-research/2026-11-23/audit_preview_duplicates.py','dataset-research/2026-11-23/preview_samples.py') },
    @{ Message='docs: record stair source clips and corrected direction labels'; Paths=@('../stair-direction/2026-11-23/COLLECTION.md','../stair-direction/2026-11-23/REVIEW.md','../stair-direction/2026-11-23/labels.csv','../stair-direction/2026-11-23/manifest.json') },
    @{ Message='feat: add reproducible preparation for stair direction clips'; Paths=@('../stair-direction/2026-11-23/prepare_clips.py','../stair-direction/2026-11-23/review_new_batches.py') },
    @{ Message='docs: add outdoor stair sample labels and review notes'; Paths=@('../stair-direction/2026-11-23/outdoor-down/labels.csv','../stair-direction/2026-11-23/outdoor-down/manifest.json','../stair-direction/2026-11-23/outdoor-down/prepare.py','../stair-direction/2026-11-23/outdoor-down/REVIEW.md') },
    @{ Message='docs: add upward stair sample labels and review notes'; Paths=@('../stair-direction/2026-11-23/outdoor-up/labels.csv','../stair-direction/2026-11-23/outdoor-up/manifest.json','../stair-direction/2026-11-23/outdoor-up/prepare.py','../stair-direction/2026-11-23/outdoor-up/REVIEW.md') },
    @{ Message='docs: add pothole and missing paver sample labels'; Paths=@('../stair-direction/2026-11-23/potholes/labels.csv','../stair-direction/2026-11-23/potholes/manifest.json','../stair-direction/2026-11-23/potholes/prepare.py','../stair-direction/2026-11-23/potholes/REVIEW.md') },
    @{ Message='docs: add intact paving negative sample annotations'; Paths=@('../stair-direction/2026-11-23/intact-ground/labels.csv','../stair-direction/2026-11-23/intact-ground/manifest.json','../stair-direction/2026-11-23/intact-ground/REVIEW.md','../stair-direction/2026-11-23/intact-ground/background-labels/*.txt') },
    @{ Message='feat: inspect Kaggle pothole datasets and document licences'; Paths=@('../stair-direction/2026-11-23/potholes/kaggle-research/inspect_dataset.py','../stair-direction/2026-11-23/potholes/kaggle-research/inspection.json','../stair-direction/2026-11-23/potholes/kaggle-research/REVIEW.md','../stair-direction/2026-11-23/potholes/kaggle-research/README.dataset.txt','../stair-direction/2026-11-23/potholes/kaggle-research/README.roboflow.txt','../stair-direction/2026-11-23/potholes/kaggle-research/*--*.json') },
    @{ Message='chore: track prepared experimental training status summaries'; Paths=@('pothole-status.json','stairs-v1-status.json','missing-tile-v2-status.json') },
    @{ Message='docs: add stair direction labeling review helper'; Paths=@('../stair-direction/2026-11-23/finalize_review.py') },
    @{ Message='docs: add intact paving frame preparation helper'; Paths=@('../stair-direction/2026-11-23/intact-ground/finalize_review.py','../stair-direction/2026-11-23/intact-ground/prepare.py') },
    @{ Message='docs: add outdoor stair clip preparation helpers'; Paths=@('../stair-direction/2026-11-23/outdoor-down/prepare.py','../stair-direction/2026-11-23/outdoor-up/prepare.py') },
    @{ Message='docs: add missing paver clip preparation helper'; Paths=@('../stair-direction/2026-11-23/potholes/prepare.py') },
    @{ Message='docs: add stair direction collection and label review notes'; Paths=@('../stair-direction/2026-11-23/COLLECTION.md','../stair-direction/2026-11-23/REVIEW.md','../stair-direction/2026-11-23/labels.csv','../stair-direction/2026-11-23/manifest.json') },
    @{ Message='docs: add paver negative sample review and labels'; Paths=@('../stair-direction/2026-11-23/intact-ground/labels.csv','../stair-direction/2026-11-23/intact-ground/manifest.json','../stair-direction/2026-11-23/intact-ground/REVIEW.md') },
    @{ Message='docs: add public pothole dataset research metadata'; Paths=@('../stair-direction/2026-11-23/potholes/kaggle-research/data.yaml','../stair-direction/2026-11-23/potholes/kaggle-research/andrewmvd--pothole-detection.json','../stair-direction/2026-11-23/potholes/kaggle-research/chitholian--annotated-potholes-dataset.json','../stair-direction/2026-11-23/potholes/kaggle-research/farzadnekouei--pothole-image-segmentation-dataset.json') },
    @{ Message='docs: add model comparison status and decisions'; Paths=@('decisions.json','model-artifacts.json','pothole-status.json','stairs-v1-status.json','missing-tile-v2-status.json') },
    @{ Message='docs: add training report generation helper'; Paths=@('build_report.py','build_targeted_report.py') },
    @{ Message='docs: add Roboflow dataset download reference page'; Paths=@('dataset-research/2026-11-23/DOWNLOADS.html') },
    @{ Message='chore: save reviewed PathSignal commit script'; Paths=@('../Commit PathSignal Training Work.ps1') },
    @{ Message='docs: record corrected stair archive duplicate audit'; Paths=@('dataset-research/2026-11-23/stairs-v1-audit-corrected/audit.json','dataset-research/2026-11-23/stairs-v1-audit-corrected/publisher-data.yaml') },
    @{ Message='docs: record missing paver archive duplicate audit'; Paths=@('dataset-research/2026-11-23/missing-tile-v2-audit-corrected/audit.json','dataset-research/2026-11-23/missing-tile-v2-audit-corrected/publisher-data.yaml') },
    @{ Message='docs: record initial targeted archive audit summaries'; Paths=@('dataset-research/2026-11-23/stairs-v1-audit/audit.json','dataset-research/2026-11-23/stairs-v1-audit/publisher-data.yaml','dataset-research/2026-11-23/missing-tile-v2-audit/audit.json','dataset-research/2026-11-23/missing-tile-v2-audit/publisher-data.yaml') },
    @{ Message='docs: record preview duplicate screening results'; Paths=@('dataset-research/2026-11-23/preview-duplicate-audit.json','dataset-research/2026-11-23/page-fetch.json') },
    @{ Message='docs: record sampled public dataset image manifests'; Paths=@('dataset-research/2026-11-23/samples/stairs-v1/manifest.json','dataset-research/2026-11-23/samples/missing-tile-v2/manifest.json') },
    @{ Message='docs: record legacy archive auditor verification'; Paths=@('dataset-research/2026-11-23/auditor-check-existing-pothole/audit.json','dataset-research/2026-11-23/auditor-check-existing-pothole/publisher-data.yaml') }
)

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.git'))) { throw "Git repository not found: $projectRoot" }
if (-not (Test-Path -LiteralPath (Join-Path $labRoot '.gitignore'))) { throw "Training lab not found: $labRoot" }

if ($Commit) {
    & git -C $projectRoot diff --cached --quiet
    if ($LASTEXITCODE -eq 1) { throw 'There are already staged files. Review them before running this script with -Commit.' }
    if ($LASTEXITCODE -ne 0) { throw 'Could not check staged files.' }
    & git -C $projectRoot var GIT_AUTHOR_IDENT 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Set your Git user.name and user.email before creating commits.' }
}

$created = 0
$number = 0
foreach ($group in $groups) {
    $number++
    $paths = @()
    foreach ($relative in $group.Paths) {
        $candidate = Join-Path $labRoot $relative
        if ($relative.Contains('*') -or $relative.Contains('?')) {
            $paths += @(Get-ChildItem -Path $candidate -File -ErrorAction SilentlyContinue | ForEach-Object {
                Convert-ToRepoPath $_.FullName
            })
        } else {
            $fullPath = [System.IO.Path]::GetFullPath($candidate)
            if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
                $paths += Convert-ToRepoPath $fullPath
            }
        }
    }

    Write-Host ("{0,2}. {1}" -f $number,$group.Message) -ForegroundColor Cyan
    if (-not $Commit) {
        Write-Host ("    Existing files selected: {0}" -f $paths.Count)
        continue
    }
    if ($paths.Count -eq 0) { Write-Host '    Skipped: these result files are not present yet.'; continue }

    & git -C $projectRoot add -- @paths
    if ($LASTEXITCODE -ne 0) { throw "Staging failed for commit group $number." }
    & git -C $projectRoot diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Host '    Skipped: no changes in this group.'; continue }
    if ($LASTEXITCODE -ne 1) { throw "Could not inspect staged changes in group $number." }
    & git -C $projectRoot commit -m $group.Message
    if ($LASTEXITCODE -ne 0) { throw "Commit failed in group $number. Review the staged files before retrying." }
    $created++
}

if ($Commit) {
    Write-Host "Created $created local commits. Nothing was pushed."
    Write-Host 'Review git status, then run git push when you are ready.'
} else {
    Write-Host "Preview complete: $($groups.Count) commit messages. Nothing was staged or committed."
    Write-Host 'Run this script again with -Commit to create the available local commits.'
}
