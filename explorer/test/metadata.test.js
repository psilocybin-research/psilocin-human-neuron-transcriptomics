import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import config from '../observablehq.config.js';

const script = config.head.match(/<script type="application\/ld\+json">(.+)<\/script>/s);
assert.ok(script, 'JSON-LD block is missing');
const metadata = JSON.parse(script[1]);
const atlasSource = readFileSync(new URL('../src/components/atlas.js', import.meta.url), 'utf8');

test('atlas exposes scholarly discovery and signposting metadata', () => {
  assert.match(config.head, /rel="canonical"/);
  assert.match(config.head, /rel="cite-as" href="https:\/\/doi\.org\/10\.5281\/zenodo\.22849800"/);
  assert.match(config.head, /rel="describedby" type="application\/vnd\.datacite\.datacite\+json"/);
  assert.match(config.head, /name="citation_doi" content="10\.5281\/zenodo\.22849800"/);
  assert.match(config.head, /property="og:image"/);
});

test('atlas foregrounds source data and the principal positive finding', () => {
  assert.match(atlasSource, /github\.com\/psilocybin-research\/psilocin-human-neuron-transcriptomics/);
  assert.match(atlasSource, /v1\.0\.1/);
  assert.match(atlasSource, /Source study · Schmidt et al\. \(2026\)/);
  assert.match(atlasSource, /Original source data · Dryad/);
  assert.match(atlasSource, /https:\/\/doi\.org\/10\.5061\/dryad\.xsj3tx9w3/);
  assert.match(atlasSource, /Broad OXPHOS signal; narrower redox mechanism unresolved/);
  assert.match(atlasSource, /that narrower result does not negate the broader transcriptional finding/);
  assert.match(atlasSource, /Exploratory DNA-maintenance evidence/);
  assert.match(atlasSource, /Study design and interpretation/);
  assert.ok(atlasSource.indexOf("heading('Study design and interpretation'") > atlasSource.indexOf("heading('Exploratory DNA-maintenance evidence'"));
  assert.match(atlasSource, /leave specificity unresolved/);
  assert.match(atlasSource, /do not demonstrate DNA-repair activity, telomere maintenance or proliferation/);
  assert.doesNotMatch(atlasSource, /el\('sup'/);
  assert.doesNotMatch(atlasSource, /¹ Faculty of Health/);
  assert.match(atlasSource, /el\('div','header-sources'\)/);
});

test('atlas progressively enhances sharing and plot fullscreen controls', () => {
  assert.match(atlasSource, /typeof navigator\.share==='function'/);
  assert.match(atlasSource, /navigator\.share\(/);
  assert.match(atlasSource, /mailto:\?subject=/);
  assert.match(atlasSource, /shareDetails/);
  assert.match(atlasSource, /syncLocation/);
  assert.match(atlasSource, /requestFullscreen/);
  assert.match(atlasSource, /webkitRequestFullscreen/);
  assert.match(atlasSource, /figure-toolbar/);
  assert.match(atlasSource, /shell\.append\(toolbar,context,host\)/);
  assert.match(atlasSource, /View .* in full screen/);
  assert.match(atlasSource, /function printFigure/);
  assert.match(atlasSource, /frame\.contentWindow/);
});

test('JSON-LD distinguishes this creator from source-study creators', () => {
  assert.equal(metadata.author.name, 'Christopher B. Germann');
  assert.ok(!metadata.author.name.includes('Schmidt'));
  const article = metadata.isBasedOn.find(item => item['@type'] === 'ScholarlyArticle');
  const dataset = metadata.isBasedOn.find(item => item['@type'] === 'Dataset');
  const software = metadata.isBasedOn.find(item => item['@type'] === 'SoftwareSourceCode');
  assert.ok(article.author.some(author => author.name === 'Malin Schmidt'));
  assert.equal(dataset.license, 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(software.identifier, 'swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048');
  assert.deepEqual(
    metadata['prov:wasDerivedFrom'].map(item => item['@id']),
    metadata.isBasedOn.map(item => item['@id'])
  );
});
