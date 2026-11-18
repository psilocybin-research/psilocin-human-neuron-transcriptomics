import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapSequenceResidues,
  featureResidues,
} from "../src/components/residue-mapping.js";
const sequence = "ACDEFGHIKLMNPQRSTVWY";
const names = [
  "ALA",
  "CYS",
  "ASP",
  "GLU",
  "PHE",
  "GLY",
  "HIS",
  "ILE",
  "LYS",
  "LEU",
  "MET",
  "ASN",
  "PRO",
  "GLN",
  "ARG",
  "SER",
  "THR",
  "VAL",
  "TRP",
  "TYR",
];
const atoms = names.map((resn, i) => ({
  atom: "CA",
  resn,
  resi: i + 31,
  chain: "B",
  icode: i === 3 ? "A" : "",
}));
test("maps canonical positions using sequence, preserving chain and insertion code", () => {
  const m = mapSequenceResidues(atoms, "MM" + sequence + "GG");
  assert.equal(m[0].position, 3);
  assert.deepEqual(
    featureResidues(m, 5, 6).map((r) => [r.resi, r.icode]),
    [
      [33, ""],
      [34, "A"],
    ],
  );
});
test("rejects ambiguous repeated matches, mismatches, short fragments and unknown residues", () => {
  assert.equal(mapSequenceResidues(atoms, sequence + sequence).length, 0);
  assert.equal(
    mapSequenceResidues(atoms, sequence.replace("A", "G")).length,
    0,
  );
  assert.equal(mapSequenceResidues(atoms.slice(0, 10), sequence).length, 0);
  assert.equal(
    mapSequenceResidues(
      [{ ...atoms[0], resn: "MSE" }, ...atoms.slice(1)],
      sequence,
    ).length,
    0,
  );
});
test("does not fill missing coordinate residues or map invalid feature bounds", () => {
  assert.equal(
    mapSequenceResidues(
      atoms.filter((_, i) => i !== 8),
      sequence,
    ).length,
    0,
  );
  assert.equal(
    featureResidues(mapSequenceResidues(atoms, sequence), 10, 3).length,
    0,
  );
});
