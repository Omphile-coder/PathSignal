[CmdletBinding()]
param([switch]$Commit)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$site = Join-Path $root 'presentation-site'
$branch = 'feature/footpath-damage-alert'
$research = 'training-lab/dataset-research/2026-11-24'
$artifacts = "$research/artifacts"
$model = 'source-model/footpath-damage'
$deck = 'PathSignal ' + [char]0x2014 + ' Final Year Project.pptx'

function New-Group([string]$Repo, [string]$Message, [string[]]$Paths, [switch]$Gitlink) {
    [pscustomobject]@{ Repo = $Repo; Message = $Message; Paths = $Paths; Gitlink = $Gitlink.IsPresent }
}

$modelFiles = @("$model/footpath-damage-deeplabv3.onnx", "$model/manifest.json")
$modelFiles += @(0..8 | ForEach-Object { "$model/footpath-data-{0:D2}.bin" -f $_ })

$groups = @(
    (New-Group $site 'feat: add shared footpath preprocessing and corridor scoring' @('src/footpath.ts'))
    (New-Group $site 'feat: load and verify the external ONNX model files' @('src/footpathModel.ts'))
    (New-Group $site 'model: package the footpath graph, manifest and nine weight files' $modelFiles)
    (New-Group $site 'feat: run footpath segmentation in a browser worker' @('src/footpath.worker.ts'))
    (New-Group $site 'build: prepare the versioned footpath assets and worker' @('scripts/prepare-model.mjs'))
    (New-Group $site 'feat: add the footpath worker to the detector lifecycle' @('src/useDetector.ts'))
    (New-Group $site 'feat: route paving detections through scan status and speech' @('src/useMonitor.ts'))
    (New-Group $site 'feat: expose the experimental paving mode in the web demo' @('src/App.tsx', 'src/retro.css'))
    (New-Group $site 'fix: allow cross-origin requests for the versioned paving model' @('vercel.json'))
    (New-Group $site 'docs: publish the paving dataset attribution and evaluation' @('public/footpath-damage-development-notes.md'))
    (New-Group $site 'docs: explain the browser and phone paving architecture' @('public/technical-notes.md'))

    (New-Group $root 'chore: pin PathSignal to the paving presentation revision' @('presentation-site') -Gitlink)
    (New-Group $root 'train: add the surface-quality notebook generator' @('training-lab/prepare_surface_quality_notebook.py'))
    (New-Group $root 'train: add the surface-quality Kaggle experiment' @('training-lab/Kaggle-Surface-Quality-Candidate.ipynb'))
    (New-Group $root 'eval: add the local surface-quality candidate runner' @('training-lab/run_surface_quality_candidate.py'))
    (New-Group $root 'eval: record the held-out surface-quality metrics' @("$artifacts/evaluation-report.json"))
    (New-Group $root 'train: preserve the surface-quality training history' @("$artifacts/training-history.json"))
    (New-Group $root 'eval: record the surface-quality candidate results on local paving frames' @("$artifacts/local-paving-frame-check.json", "$artifacts/local-paving-frame-check.md"))
    (New-Group $root 'data: document the StreetSurfaceVis source review' @("$research/streetsurfacevis-candidate-evaluation.json", "$research/streetsurfacevis-candidate-evaluation.md"))
    (New-Group $root 'train: add the footpath segmentation notebook generator' @('training-lab/prepare_footpath_notebook.py'))
    (New-Group $root 'train: add the footpath segmentation Kaggle experiment' @('training-lab/Kaggle-Footpath-Damage-Candidate.ipynb'))
    (New-Group $root 'eval: record the held-out footpath segmentation metrics' @("$artifacts/footpath-damage-evaluation-report.json"))
    (New-Group $root 'train: preserve the footpath segmentation training history' @("$artifacts/footpath-damage-training-history.json"))
    (New-Group $root 'build: add the byte-preserving ONNX weight packer' @('training-lab/prepare_footpath_onnx_chunks.py'))
    (New-Group $root 'eval: add local paving inference and corridor alert review' @('training-lab/run_footpath_damage_local_review.py'))
    (New-Group $root 'docs: record the experimental paving candidate decision' @("$artifacts/footpath-damage-candidate-review.md"))
    (New-Group $root 'docs: record the supervised iPhone observation' @('training-lab/supervised-phone-observation-2026-11-23.md'))

    (New-Group $root 'build: declare Expo Constants for the development server address' @('phone/package.json', 'phone/package-lock.json'))
    (New-Group $root 'feat: add the phone paving inference adapter and rebuild detector pages' @('phone/worker/detector.ts', 'phone/worker/build.cjs', 'phone/assets/model/footpath-detector.html', 'phone/assets/model/detector.html', 'phone/assets/model/rod-detector.html', 'phone/assets/model/stairs-detector.html'))
    (New-Group $root 'feat: serve the paving detector and weights from Expo on the LAN' @('phone/metro.config.js'))
    (New-Group $root 'feat: connect the phone WebView to the paving detector' @('phone/useObjectWorker.tsx'))
    (New-Group $root 'feat: add the paving camera mode, spoken alert and scan details' @('phone/App.tsx'))
    (New-Group $root 'docs: add Expo Go instructions for damaged paving' @('phone/README.md'))
    (New-Group $root 'docs: update the final-year presentation slides' @($deck))
    (New-Group $root 'chore: keep Office locks and duplicate ONNX data out of Git' @('.gitignore', 'training-lab/.gitignore', ('~$' + $deck)))
    (New-Group $root 'chore: add the reviewed footpath commit script' @('Commit-PathSignal-Footpath.ps1'))
)

function Invoke-Git([string]$Repo, [string[]]$GitArgs) {
    $output = & git -C $Repo --literal-pathspecs @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Git failed in $Repo for '$($GitArgs -join ' ')'. Check git status before retrying."
    }
    $output
}

function Assert-NoStagedChanges([string]$Repo) {
    $staged = @(Invoke-Git $Repo @('diff', '--cached', '--name-only'))
    if ($staged.Count -gt 0) {
        throw "There are already staged changes in $Repo. Review them before running this script."
    }
}

function Get-GroupChanges($Group) {
    Invoke-Git $Group.Repo (@('status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=dirty', '--') + $Group.Paths)
}

function Assert-ExpectedPath([string]$Repo, [string]$GitPath, [string]$ExpectedPath) {
    if (-not $GitPath -or (Resolve-Path -LiteralPath $GitPath).Path -ne (Resolve-Path -LiteralPath $ExpectedPath).Path) {
        throw "The expected Git checkout was not found at $Repo."
    }
}

if ($groups.Count -le 30) { throw 'The commit plan must contain more than 30 groups.' }
Assert-ExpectedPath $root (Invoke-Git $root @('rev-parse', '--show-toplevel')) $root
Assert-ExpectedPath $site (Invoke-Git $site @('rev-parse', '--show-toplevel')) $site
Assert-ExpectedPath $site (Invoke-Git $site @('rev-parse', '--show-superproject-working-tree')) $root

$history = @{}
foreach ($repo in @($site, $root)) {
    $currentBranch = Invoke-Git $repo @('symbolic-ref', '--quiet', '--short', 'HEAD')
    if ($currentBranch -ne $branch) { throw "Switch $repo to '$branch' before running this script. Current branch: '$currentBranch'." }
    Assert-NoStagedChanges $repo
    $history[$repo] = @(Invoke-Git $repo @('log', '-n', '200', '--format=%s'))
    if ($Commit) {
        Invoke-Git $repo @('var', 'GIT_AUTHOR_IDENT') | Out-Null
        Invoke-Git $repo @('var', 'GIT_COMMITTER_IDENT') | Out-Null
    }
}

$plan = @()
$sitePending = $false
$issues = @()
foreach ($group in $groups) {
    $changed = @(Get-GroupChanges $group).Count -gt 0
    if ($group.Gitlink -and $sitePending) { $changed = $true }
    $recorded = $history[$group.Repo] -ccontains $group.Message
    $state = if ($changed -and -not $recorded) { 'ready' } elseif (-not $changed -and $recorded) { 'committed' } else { 'review' }
    if ($state -eq 'review') {
        $issues += "Unexpected state for '$($group.Message)'. Check its paths and git log."
    }
    if ($state -eq 'ready' -and $group.Repo -eq $site) { $sitePending = $true }
    if ($state -eq 'ready' -and -not $group.Gitlink) {
        foreach ($file in $group.Paths) {
            $fullPath = Join-Path $group.Repo $file
            if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
                if ((Get-Item -LiteralPath $fullPath -Force).Length -ge 100MB) {
                    $issues += "File meets or exceeds 100 MiB: $fullPath"
                }
            } elseif (@(Invoke-Git $group.Repo @('ls-files', '--', $file)).Count -ne 1) {
                $issues += "Planned path cannot be found: $fullPath"
            }
        }
    }
    $plan += [pscustomobject]@{ Group = $group; State = $state }
}

for ($i = 0; $i -lt $plan.Count; $i++) {
    $entry = $plan[$i]
    $label = if ($entry.Group.Repo -eq $site) { 'presentation-site' } else { 'PathSignal' }
    Write-Host ('{0,2}. [{1}] {2} ({3})' -f ($i + 1), $label, $entry.Group.Message, $entry.State)
    if (-not $Commit) {
        foreach ($file in $entry.Group.Paths) { Write-Host "    $file" }
    }
}
if ($issues.Count -gt 0) { throw ($issues -join [Environment]::NewLine) }

$pending = @($plan | Where-Object State -eq 'ready')
$siteGroups = @($groups | Where-Object Repo -eq $site).Count
Write-Host "$($groups.Count) planned commits ($siteGroups presentation-site, $($groups.Count - $siteGroups) PathSignal). $($pending.Count) pending."
if (-not $Commit) {
    Write-Host 'Preview only. Run .\Commit-PathSignal-Footpath.ps1 -Commit to create pending commits.'
    return
}

foreach ($entry in $pending) {
    $group = $entry.Group
    Assert-NoStagedChanges $group.Repo
    if (@(Get-GroupChanges $group).Count -eq 0) {
        throw "Changes disappeared for '$($group.Message)'. Run the preview again."
    }
    Invoke-Git $group.Repo (@('add', '--all', '--') + $group.Paths)
    if (@(Invoke-Git $group.Repo @('diff', '--cached', '--name-only')).Count -eq 0) {
        throw "Nothing staged for '$($group.Message)'. Run the preview again."
    }
    Invoke-Git $group.Repo @('commit', '-m', $group.Message)
}

Write-Host "Created $($pending.Count) local commits on $branch."
