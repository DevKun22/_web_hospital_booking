import assert from "node:assert/strict";
import test from "node:test";

import { parseSearchText } from "../../src/services/search/search.query.js";

test("accents are folded, words are AND-ed and only the last word is a prefix term", () => {
  const parsed = parseSearchText("  Tim  Mạch Đau Ngực ");
  assert.deepEqual(parsed.tokens, ["tim", "mach", "dau", "nguc"]);
  assert.equal(parsed.phrase, "tim mach dau nguc");
  assert.equal(parsed.tsQuery, "tim & mach & dau & nguc:*");
  assert.equal(parseSearchText("tim").tsQuery, "tim:*");
});

test("tsquery operators and punctuation can never reach the query text", () => {
  const parsed = parseSearchText("tim' | !mach & (x):* -- \"y\" % _ \\");
  assert.match(parsed.tsQuery, /^[a-z0-9:* &]+$/);
  assert.equal(parsed.tsQuery, "tim & mach & x & y:*");
  assert.match(parsed.phrase, /^[a-z0-9 ]+$/);
  assert.deepEqual(parsed.tokens, ["tim", "mach", "x", "y"]);
});

test("the number of terms is capped and empty input yields no terms", () => {
  assert.equal(parseSearchText("a b c d e f g h i j k l m").tokens.length, 10);
  assert.deepEqual(parseSearchText("   ... !!! ").tokens, []);
  assert.equal(parseSearchText("").tsQuery, "");
});
