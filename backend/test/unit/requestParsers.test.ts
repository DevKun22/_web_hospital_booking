import assert from "node:assert/strict";
import test from "node:test";
import {
  getRequiredPathParam,
  parseBooleanQuery,
  parseNumberQuery,
} from "../../src/shared/http/requestParsers.js";
import { AppError } from "../../src/utils/appError.js";

test("getRequiredPathParam keeps the first Express path value", () => {
  assert.equal(getRequiredPathParam("appointment-1"), "appointment-1");
  assert.equal(
    getRequiredPathParam(["appointment-1", "appointment-2"]),
    "appointment-1",
  );
});

test("getRequiredPathParam preserves the Vietnamese validation contract", () => {
  assert.throws(
    () => getRequiredPathParam(undefined, "appointmentId"),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.message === "Thiếu appointmentId",
  );
});

test("parseBooleanQuery only accepts the existing true and false values", () => {
  assert.equal(parseBooleanQuery("true"), true);
  assert.equal(parseBooleanQuery("false"), false);
  assert.equal(parseBooleanQuery("1"), undefined);
  assert.equal(parseBooleanQuery(true), undefined);
});

test("parseNumberQuery preserves the current optional number behaviour", () => {
  assert.equal(parseNumberQuery("20"), 20);
  assert.equal(parseNumberQuery(""), 0);
  assert.equal(parseNumberQuery("Infinity"), undefined);
  assert.equal(parseNumberQuery(20), undefined);
});
