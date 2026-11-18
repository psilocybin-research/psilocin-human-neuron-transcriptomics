// Conservative sequence mapping. Coverage labels and residue-number offsets are not alignments.
const amino = {
  ALA: "A",
  ARG: "R",
  ASN: "N",
  ASP: "D",
  CYS: "C",
  GLN: "Q",
  GLU: "E",
  GLY: "G",
  HIS: "H",
  ILE: "I",
  LEU: "L",
  LYS: "K",
  MET: "M",
  PHE: "F",
  PRO: "P",
  SER: "S",
  THR: "T",
  TRP: "W",
  TYR: "Y",
  VAL: "V",
};
export function mapSequenceResidues(atoms, sequence) {
  const chains = new Map();
  for (const atom of atoms) {
    if (atom.atom !== "CA" || atom.hetflag) continue;
    const chain = String(atom.chain ?? ""),
      key = `${atom.resi}:${atom.icode || ""}`;
    if (!chains.has(chain)) chains.set(chain, new Map());
    if (!chains.get(chain).has(key))
      chains
        .get(chain)
        .set(key, {
          chain,
          resi: atom.resi,
          icode: atom.icode || "",
          aa: amino[atom.resn] || "?",
        });
  }
  const mapped = [];
  for (const residues of chains.values()) {
    const values = [...residues.values()],
      fragment = values.map((r) => r.aa).join("");
    if (
      !fragment ||
      fragment.includes("?") ||
      (fragment.length < 20 && fragment !== sequence)
    )
      continue;
    const start = sequence.indexOf(fragment);
    if (start < 0 || sequence.indexOf(fragment, start + 1) >= 0) continue;
    values.forEach((r, i) =>
      mapped.push({
        position: start + i + 1,
        chain: r.chain,
        resi: r.resi,
        icode: r.icode,
      }),
    );
  }
  return mapped;
}
export function featureResidues(mapping, start, end) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 1 ||
    end < start
  )
    return [];
  return mapping.filter((r) => r.position >= start && r.position <= end);
}
