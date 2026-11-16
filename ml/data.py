"""Dataset indexing with leak-free, group-aware splits.

Both published datasets were augmented *offline* (15–16 variants per photo).
If variants of the same physical leaf land in train and test, accuracy is
inflated. We therefore index only the original photographs, group every
sample by its source-leaf id, and split by group. Variants are never used
for evaluation.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np
from PIL import Image

REGISTRY = Path(__file__).with_name("crops.json")
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def load_registry(path: Path = REGISTRY) -> list[dict]:
    datasets = json.loads(path.read_text())["datasets"]
    ids = [c["id"] for d in datasets for c in d["classes"]]
    assert len(ids) == len(set(ids)), "duplicate class id in crops.json"
    for d in datasets:
        for c in d["classes"]:
            assert c["id"].startswith(d["crop"] + "__"), f"{c['id']} must start with {d['crop']}__"
    return datasets


DATASETS = load_registry()
CLASSES = [c["id"] for d in DATASETS for c in d["classes"]]


@dataclass
class Sample:
    path: str
    label: int
    group: str  # crop/class/leaf-id — all variants of one photo share a group


def index_dataset(spec: dict, root: Path) -> list[Sample]:
    """Index one dataset described in crops.json.

    layout "variants": the dataset was augmented offline; only the original
      photo of each leaf (<prefix>_<n><original>.jpg) is used, keyed by n.
    layout "folders": one folder of photos per class, no offline augmentation;
      every photo is its own leaf (near-duplicates are merged later anyway).
    """
    gp = spec.get("group_prefix", spec["crop"])
    out = []
    for c in spec["classes"]:
        label = CLASSES.index(c["id"])
        folder = root / c["folder"]
        assert folder.is_dir(), f"missing folder {folder} for {c['id']}"
        if spec["layout"] == "variants":
            prefix, orig = c["prefix"], c["original"]
            for p in sorted(folder.glob(f"{prefix}_*{orig}.jpg")):
                m = re.match(rf"{re.escape(prefix)}_(\d+){re.escape(orig)}$", p.stem)
                if m:
                    out.append(Sample(str(p), label, f"{gp}/{prefix}/{m.group(1)}"))
        elif spec["layout"] == "folders":
            pattern = c.get("pattern", "*")
            for p in sorted(folder.rglob(pattern)):
                if p.is_file() and p.suffix.lower() in IMAGE_EXT:
                    out.append(Sample(str(p), label, f"{gp}/{c['id']}/{p.relative_to(folder).with_suffix('')}"))
        else:
            raise ValueError(f"unknown layout {spec['layout']!r} for {spec['crop']}")
        assert any(s.label == label for s in out), f"no photos found for {c['id']} in {folder}"
    return out


def dhash(path: str, size: int = 8) -> int:
    im = Image.open(path).convert("L").resize((size + 1, size), Image.BILINEAR)
    a = np.asarray(im, dtype=np.int16)
    bits = (a[:, 1:] > a[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def merge_near_duplicates(samples: list[Sample], max_hamming: int = 4) -> tuple[list[Sample], int, list]:
    """Photos of the same leaf taken twice would leak across splits.
    Near-duplicates with *conflicting* labels are removed (label noise);
    same-label near-duplicates are unioned into one group."""
    hashes = [dhash(s.path) for s in samples]
    conflicts = set()
    conflict_pairs = []
    for i in range(len(samples)):
        for j in range(i + 1, len(samples)):
            if samples[i].label != samples[j].label and bin(hashes[i] ^ hashes[j]).count("1") <= max_hamming:
                conflicts.update((i, j))
                conflict_pairs.append([samples[i].path.split("/")[-1], samples[j].path.split("/")[-1]])
    keep = [k for k in range(len(samples)) if k not in conflicts]
    samples = [samples[k] for k in keep]
    hashes = [hashes[k] for k in keep]
    parent = list(range(len(samples)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    merged = 0
    for i in range(len(samples)):
        for j in range(i + 1, len(samples)):
            if bin(hashes[i] ^ hashes[j]).count("1") <= max_hamming:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[rj] = ri
                    merged += 1
    roots = [samples[find(i)].group for i in range(len(samples))]
    for s, g in zip(samples, roots):
        s.group = g
    return samples, merged, conflict_pairs


def group_split(samples: list[Sample], fractions=(0.70, 0.15, 0.15), seed: int = 42):
    """Stratified (by class) group split. Every group lands in exactly one split."""
    rng = np.random.default_rng(seed)
    splits = {"train": [], "val": [], "test": []}
    for label in range(len(CLASSES)):
        groups = sorted({s.group for s in samples if s.label == label})
        rng.shuffle(groups)
        n = len(groups)
        n_val = int(round(n * fractions[1]))
        n_test = int(round(n * fractions[2]))
        assign = {g: "test" for g in groups[:n_test]}
        assign.update({g: "val" for g in groups[n_test:n_test + n_val]})
        assign.update({g: "train" for g in groups[n_test + n_val:]})
        for s in samples:
            if s.label == label:
                splits[assign[s.group]].append(s)
    # sanity: no group in two splits
    seen = {}
    for name, ss in splits.items():
        for s in ss:
            assert seen.setdefault(s.group, name) == name, f"group leak: {s.group}"
    return splits


def build_index(roots: dict[str, Path], out: Path) -> dict:
    missing = [d["crop"] for d in DATASETS if d["crop"] not in roots]
    assert not missing, f"pass --data for: {', '.join(missing)}"
    samples = [s for d in DATASETS for s in index_dataset(d, roots[d["crop"]])]
    samples, merged, conflicts = merge_near_duplicates(samples)
    splits = group_split(samples)
    manifest = {
        "classes": CLASSES,
        "near_duplicates_merged": merged,
        "label_conflicts_removed": conflicts,
        "counts": {k: {c: sum(1 for s in v if s.label == i) for i, c in enumerate(CLASSES)} for k, v in splits.items()},
        "splits": {k: [asdict(s) for s in v] for k, v in splits.items()},
        "sha256": hashlib.sha256(json.dumps([s.path for s in samples]).encode()).hexdigest(),
    }
    out.write_text(json.dumps(manifest, indent=1))
    return manifest


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Leak-free split for every dataset in crops.json")
    ap.add_argument("--data", action="append", default=[], metavar="CROP=PATH",
                    help="dataset root per crop, e.g. --data ridge_gourd=~/Processed_Leaves --data brinjal=~/Brinjal_Dataset")
    ap.add_argument("--out", default="artifacts/split.json")
    a = ap.parse_args()
    roots = {}
    for item in a.data:
        crop, _, path = item.partition("=")
        roots[crop] = Path(path).expanduser()
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    m = build_index(roots, Path(a.out))
    print(json.dumps({k: m[k] for k in ("near_duplicates_merged", "label_conflicts_removed", "counts")}, indent=1))
