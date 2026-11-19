import test from "node:test";
import assert from "node:assert/strict";
import { parseExploratoryCSV, exploratoryColumns, exploratoryPoints, numericCSVValue, EXPLORATORY_PREVIEW_LIMITS } from "../src/components/exploratory-result-data.js";

test("exploratory CSV preserves quoted commas, escaped quotes, CRLF and embedded newlines", () => {
  const parsed = parseExploratoryCSV('\ufeffgene_id,x,y,note\r\nENSG00000117592.8,1.25,-2e-3,"a,b"\r\nENSG00000141510,2,3,"a""b\nnext"');
  assert.equal(parsed.error, null);
  assert.equal(parsed.rows[0][3], "a,b");
  assert.equal(parsed.rows[1][3], 'a"b\nnext');
  assert.equal(parsed.rows[0][2], "-2e-3");
  assert.deepEqual(exploratoryPoints(parsed, 1, 2)[0], { x: 1.25, y: -0.002, rowIndex: 0, geneId: "ENSG00000117592.8" });
});

test("missing values and nondecimal strings cannot silently become numerical observations", () => {
  for (const value of ["", " ", "NA", "NaN", "Infinity", "0x10", "1,2"]) assert.equal(numericCSVValue(value), null);
  assert.equal(numericCSVValue(".5"), 0.5);
  const parsed = parseExploratoryCSV("name,x,y\nGPX4,0,2\nPRDX6,NA,3\nCS,1,Inf");
  assert.deepEqual(exploratoryColumns(parsed).map((column) => column.index), [1, 2]);
  assert.equal(exploratoryPoints(parsed, 1, 2).length, 1);
  assert.equal(exploratoryPoints(parsed, 1, 2)[0].geneId, null);
});

test("gene linking requires exact ENSG identity in an explicit identifier column", () => {
  const parsed = parseExploratoryCSV("id,x,y\nENSG00000117592.8,1,2\nENSG123,1,2\nGPX4,1,2\n ENSG00000117592.8,1,2");
  assert.deepEqual(exploratoryPoints(parsed, 1, 2).map((point) => point.geneId), ["ENSG00000117592.8", null, null, null]);
  assert.equal(exploratoryPoints(parseExploratoryCSV("symbol,x,y\nENSG00000117592.8,1,2"), 1, 2)[0].geneId, null);
});

test("bounded previews discard incomplete records and reject malformed CSV", () => {
  const csv = "x,y\n" + "1,2\n".repeat(EXPLORATORY_PREVIEW_LIMITS.rows + 3);
  const parsed = parseExploratoryCSV(csv);
  assert.equal(parsed.rows.length, EXPLORATORY_PREVIEW_LIMITS.rows);
  assert.equal(parsed.truncated, true);
  assert.match(parseExploratoryCSV('x,y\n1,"unterminated').error, /quoted/);
  assert.match(parseExploratoryCSV('x,y\n1,"closed"junk').error, /malformed/);
  assert.match(parseExploratoryCSV("x,y\n1,2,3").error, /number of fields/);
  const huge = parseExploratoryCSV("x,y\n1,2\n" + "a".repeat(EXPLORATORY_PREVIEW_LIMITS.characters));
  assert.equal(huge.truncated, true);
  assert.deepEqual(huge.rows, [["1", "2"]]);
});

test('network overlay rejects ambiguous duplicates and truncated evidence', async () => {
 const {exploratoryNetworkValues} = await import('../src/components/exploratory-result-data.js');
 const parsed = parseExploratoryCSV('id,value\nENSG00000123456,0.123456789012345\nUNKNOWN,9\nENSG00000123457,NA');
 assert.deepEqual(exploratoryNetworkValues(parsed,1).values,[{id:'ENSG00000123456',value:0.123456789012345}]);
 assert.equal(exploratoryNetworkValues(parsed,1).omitted,2);
 assert.throws(()=>exploratoryNetworkValues({...parsed,truncated:true},1),/complete/);
 assert.throws(()=>exploratoryNetworkValues(parseExploratoryCSV('id,value\nENSG00000123456,1\nENSG00000123456,2'),1),/occur once/);
});
