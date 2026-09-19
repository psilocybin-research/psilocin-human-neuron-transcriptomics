import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../observablehq.config.js';

const script = config.head.match(/<script type="application\/ld\+json">(.+)<\/script>/s);
assert.ok(script, 'JSON-LD block is missing');
const metadata = JSON.parse(script[1]);

test('atlas exposes scholarly discovery and signposting metadata', () => {
  assert.match(config.head, /rel="canonical"/);
  assert.match(config.head, /rel="cite-as" href="https:\/\/doi\.org\/10\.5281\/zenodo\.22843281"/);
  assert.match(config.head, /rel="describedby" type="application\/vnd\.datacite\.datacite\+json"/);
  assert.match(config.head, /name="citation_doi" content="10\.5281\/zenodo\.22843281"/);
  assert.match(config.head, /property="og:image"/);
});

test('JSON-LD distinguishes this creator from source-study creators', () => {
  assert.equal(metadata.author.name, 'Christopher B. Germann');
  assert.ok(!metadata.author.name.includes('Schmidt'));
  const article = metadata.isBasedOn.find(item => item['@type'] === 'ScholarlyArticle');
  const dataset = metadata.isBasedOn.find(item => item['@type'] === 'Dataset');
  const software = metadata.isBasedOn.find(item => item['@type'] === 'SoftwareSourceCode');
  assert.ok(article.author.some(author => author.name === 'Markus Schmidt'));
  assert.equal(dataset.license, 'https://creativecommons.org/publicdomain/zero/1.0/');
  assert.equal(software.identifier, 'swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048');
  assert.deepEqual(
    metadata['prov:wasDerivedFrom'].map(item => item['@id']),
    metadata.isBasedOn.map(item => item['@id'])
  );
});
