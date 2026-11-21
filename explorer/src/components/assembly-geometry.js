// Physical geometry is preserved across chains; no force-layout coordinates enter here.
export function backboneSegments(residues) {
  const result = [];
  for (let i = 1; i < residues.length; i++) {
    const a = residues[i - 1], b = residues[i];
    const adjacent = b[0] === a[0] + 1 || (b[0] === a[0] && a[1] !== b[1]);
    const distance = Math.hypot(...a.slice(2).map((v, j) => v - b[j + 2]));
    if (adjacent && distance >= 2.5 && distance <= 4.5) result.push([a.slice(2), b.slice(2)]);
  }
  return result;
}
