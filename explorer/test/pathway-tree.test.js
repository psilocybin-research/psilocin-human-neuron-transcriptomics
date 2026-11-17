import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathwayBranches, exportMembershipRows, families} from '../src/components/pathway-tree.js';
const load = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const atlas = load('atlas'), genes = load('genes');

test('tree preserves complete frozen families and exact contrast-specific leading edges', () => {
  for (const contrast of atlas.contrasts) {
    const branches = pathwayBranches(atlas, genes, contrast);
    assert.equal(branches.length, 14);
    for (const [tier, count] of [['primary', 5], ['secondary', 7], ['exploratory', 2]]) {
      assert.equal(branches.filter(b => b.row.tier === tier).length, count);
      assert.equal(families[tier].tests, count * 3);
    }
    for (const b of branches) {
      assert.deepEqual(b.children.map(g => g.symbol).sort(), b.row.leadingEdge ? b.row.leadingEdge.split(';').sort() : []);
      assert.ok(b.children.every(g => g.leading && g.gene?.selected));
    }
  }
});

test('annotated view retains absent genes and untestable sets without turning them into nulls', () => {
  const all = pathwayBranches(atlas, genes, atlas.contrasts[0], {members: 'all'});
  const absent = all.flatMap(b => b.children).filter(g => !g.gene);
  assert.ok(absent.length > 0);
  assert.ok(absent.every(g => g.effect === undefined));
  const untestable = all.find(b => b.row.pathway === 'REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING');
  assert.equal(untestable.row.NES, null);
  assert.equal(untestable.children.length, 12);
  const rows = exportMembershipRows(all, atlas.contrasts[0]);
  assert.ok(rows.filter(r => !r.gene_id).every(r => r.log2FoldChange === null && r.gene_fdr === null));
  assert.ok(rows.filter(r => r.pathway === untestable.row.pathway).every(r => r.pathway_NES === null));
});

test('gene search exposes overlapping memberships without counting them as distinct genes', () => {
  const found = pathwayBranches(atlas, genes, 'day1_vs_control', {query: 'GPX4'});
  assert.ok(found.length > 1);
  assert.ok(found.every(b => b.children.every(g => g.symbol === 'GPX4')));
  const rows = exportMembershipRows(found, 'day1_vs_control');
  assert.equal(new Set(rows.map(r => r.gene_id)).size, 1);
  assert.ok(rows.every(r => r.log2FoldChange === rows[0].log2FoldChange));
  assert.equal(pathwayBranches(atlas, genes, 'day1_vs_control', {query: '<unknown-gene>'}).length, 0);
});

test('alias and Ensembl searches retain original gene identity and original estimates', () => {
  const alias = pathwayBranches(atlas, genes, 'day1_vs_control', {members: 'all', query: 'ATP5F1A'});
  assert.ok(alias.some(b => b.children.some(g => g.symbol === 'ATP5F1A' && g.gene === undefined)));
  assert.ok(!alias.some(b => b.children.some(g => g.symbol === 'ATP5A1')), 'do not silently expand literal frozen membership');
  const reference = genes.find(g => g.symbol === 'GPX4' && g.selected);
  const found = pathwayBranches(atlas, genes, 'day3_vs_control', {members: 'all', query: reference.id});
  assert.ok(found.length);
  assert.ok(found.every(b => b.children.every(g => g.gene.id === reference.id && g.effect === reference.effects[1])));
  assert.throws(() => pathwayBranches(atlas, genes, 'unknown'), /Unknown pathway contrast/);
});
