"""Generate an auditable decision report for the corrected targeted-model runs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RUNS = ROOT / "runs"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def model_record(name):
    training = read_json(RUNS / f"{name}-summary.json")
    evaluation = read_json(RUNS / f"{name}-evaluation" / "results.json")
    runtime = read_json(RUNS / f"{name}-evaluation" / "onnx-check.json")
    manifest = read_json(ROOT / "datasets" / name / "manifest.json")
    artifacts = []
    for kind in ("checkpoint", "onnx"):
        path = Path(training[kind])
        data = path.read_bytes()
        artifacts.append({"kind": kind, "relative_path": str(path.relative_to(ROOT)),
                          "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    return {"dataset": name, "decision": "rejected_for_app_integration" if not evaluation["passes_local_screen"] else "browser_check_required",
            "passes_local_screen": evaluation["passes_local_screen"],
            "cpu_onnx_parity_passed": runtime["all_passed"],
            "browser_wasm_parity": "not_run_candidate_failed_local_screen",
            "physical_iphone_tested": False, "app_updated": False,
            "training": {k: training[k] for k in ("dataset", "elapsed_seconds", "public_test_metrics", "selection", "local_clips_used_for_training")},
            "dataset_manifest": {k: manifest[k] for k in ("original_images", "selected_images", "excluded_similar_views", "split_counts", "classes")},
            "evaluation": {k: v for k, v in evaluation.items() if k not in ("rows", "policy")},
            "artifacts": artifacts}


def main():
    records = [model_record("stairs-v1-corrected"), model_record("missing-tile-v2-corrected")]
    (ROOT / "corrected-model-decisions.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    stairs, pavers = records
    s, p = stairs["evaluation"], pavers["evaluation"]
    lines = [
        "# Corrected targeted-model decision report — 23 November 2026", "",
        "## Decision", "",
        "Neither corrected candidate qualifies for PathSignal app integration under the predeclared local engineering screens. Both CPU ONNX exports match their PyTorch outputs on the checked frames. Browser and iPhone tests were not run because the candidates failed the local screen. The existing app was not changed.", "",
        "These are small, correlated development-frame checks. They do not establish safe walking use, warning distance, depth measurement, general hole detection, or performance at unseen locations.", "",
        "## Corrected datasets and training", "",
        "The first stair run was invalidated after a later filename-variant audit found related images across publisher splits. Corrected runs grouped normalized filenames, perceptual candidates, and exact duplicates before splitting. Local user clips were excluded from training and checkpoint selection.", "",
        "| Candidate | Source images | Selected | Train / validation / test | Public test mAP50 | CPU ONNX parity | Decision |",
        "|---|---:|---:|---:|---:|---|---|"
    ]
    for r in records:
        m = r["dataset_manifest"]
        split = m["split_counts"]
        lines.append(f"| {r['dataset']} | {m['original_images']} | {m['selected_images']} | {split['train']} / {split['valid']} / {split['test']} | {r['training']['public_test_metrics'].get('metrics/mAP50(B)', 0):.3f} | {r['cpu_onnx_parity_passed']} | {r['decision']} |")
    lines += ["", "The missing-tile public test has highly repetitive tiled backgrounds. Its strong public score is not representative of different outdoor paving. The local labels are approximate, single-assistant box annotations.", "",
        "## Stair direction", "",
        f"- Stair frames with a generic stair alert: **{s['local_stairs']['generic_stair_alerts']}/{s['local_stairs']['frames']}**.",
        f"- Correct direction alerts: **{s['local_stairs']['correct_direction']}/{s['local_stairs']['frames']}**; wrong direction alerts: **{s['local_stairs']['wrong_direction']}/{s['local_stairs']['frames']}**.",
        f"- Non-stair paving/intact frames with alerts: **{s['nonstair_false_alert_frames']}/15**; older negative checks with alerts: **{s['older_negative_check']['frames_alerted']}/{s['older_negative_check']['frames']}**.", "",
        "| Stair clip | Frames | Generic alerts | Correct direction | Wrong direction |",
        "|---|---:|---:|---:|---:|"]
    for clip, values in s["per_clip"].items():
        if clip in ("P1-pothole", "P2-pothole", "N1-intact"):
            continue
        lines.append(f"| {clip} | {values['frames']} | {values['generic_stair_alerts']} | {values['correct_direction']} | {values['wrong_direction']} |")
    lines += ["", "Direction fails the preset screen: seven wrong-direction alerts (limit one), plus three alerts across the 15 non-stair paving/intact frames (limit one). This model should not be used to tell a traveler whether stairs go up or down.", "",
        "## Missing-paver localization", "",
        f"- Local defect frames with any model box: **{p['local_paving']['positive_frames_with_any_prediction']}/10**.",
        f"- Local defect frames with a box matching the saved reference at IoU 0.5: **{p['local_paving']['positive_frames_with_localized_match']}/10**.",
        f"- Intact-ground frames with a corridor alert: **{p['per_clip']['N1-intact']['negative_frames_alerted']}/5**.",
        f"- Stair frames with a false missing-paver corridor alert: **{p['stair_frames_falsely_labelled_missing_paver']}/40**; older negative checks alerted: **{p['older_negative_check']['frames_alerted']}/{p['older_negative_check']['frames']}**.", "",
        "| Defect clip | Frames | Frames with any box | Frames with matched box |",
        "|---|---:|---:|---:|"]
    for clip in ("P1-pothole", "P2-pothole"):
        v = p["per_clip"][clip]
        lines.append(f"| {clip} | {v['frames']} | {v['positive_frames_with_any_prediction']} | {v['positive_frames_with_localized_match']} |")
    lines += ["", "The corrected evaluator attaches the frozen local reference boxes to the corrected model run and records all prediction boxes and scores in `runs/missing-tile-v2-corrected-evaluation/results.json`. The model did not localize any annotated defect box at the fixed IoU threshold, so it fails the local screen despite public test performance. This is a failed detection/localization check, not evidence that the road defects are absent.", "",
        "## Reproduction and artifacts", "",
        "Run `training-lab/.venv/Scripts/python.exe training-lab/build_corrected_report.py` from the project root to regenerate this report and `training-lab/corrected-model-decisions.json`. Per-frame predictions, evaluation policy, ONNX parity checks, checkpoints and exported ONNX files remain in the corresponding `training-lab/runs/*-corrected*` folders.", "",
        "Next model iteration should add independently sourced outdoor missing-paver scenes and stair scenes, then reserve unseen locations for evaluation. Do not integrate either current candidate until it passes a fixed local screen and browser decoder/runtime parity. iPhone validation remains a later, supervised prototype test.", ""]
    (ROOT / "CORRECTED-MODEL-RESULTS.md").write_text("\n".join(lines), encoding="utf-8")
    print("Wrote CORRECTED-MODEL-RESULTS.md and corrected-model-decisions.json")


if __name__ == "__main__":
    main()
