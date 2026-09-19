import assert from "node:assert/strict";
import { test } from "node:test";
import { toObservationSummary, toOahObservation } from "../src/mapping.js";
import { MAX_PHOTO_BYTES, parsePhoto, photoTransaction } from "../src/photos.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`;

test("accepts jpeg, png and webp data URLs whose bytes match the declared type", () => {
  for (const [type, bytes] of [["image/png", PNG], ["image/jpeg", JPEG], ["image/webp", WEBP]] as const) {
    const photo = parsePhoto(dataUrl(type, bytes));
    assert.ok(typeof photo === "object", type);
    assert.equal(photo.contentType, type);
    assert.ok(photo.data.equals(bytes));
  }
});

test("rejects other types, mismatched bytes, bad encoding and oversized photos", () => {
  assert.match(parsePhoto(dataUrl("image/gif", Buffer.from("GIF89a"))) as string, /must be one of/);
  assert.match(parsePhoto(dataUrl("image/png", JPEG)) as string, /not a valid image\/png/);
  assert.match(parsePhoto(dataUrl("image/jpeg", Buffer.from("<svg onload=alert(1)>"))) as string, /not a valid/);
  assert.match(parsePhoto("data:image/png;base64,***") as string, /base64 data URL/);
  assert.match(parsePhoto("https://example.org/x.png") as string, /base64 data URL/);
  const big = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]);
  assert.match(parsePhoto(dataUrl("image/jpeg", big)) as string, /at most 1.5 MB/);
});

test("photo transaction stores Binary, Media and the Observation linked through derivedFrom", () => {
  const observation = toOahObservation({
    siteId: "Loc-Almyros", indicator: "filamentousAlgae", value: "present", observedAt: "2026-09-19T08:30:00Z", reporter: "Maria",
  });
  const photo = parsePhoto(dataUrl("image/png", PNG));
  assert.ok(typeof photo === "object");
  const [binary, media, report] = photoTransaction(observation, photo).entry ?? [];
  assert.equal(binary?.request?.method, "PUT");
  const mediaResource = media?.resource as fhir4.Media;
  assert.equal(mediaResource.subject?.reference, "Location/Loc-Almyros");
  assert.equal(mediaResource.operator?.display, "Maria");
  assert.ok(mediaResource.content.url?.endsWith(`/Binary/${binary?.resource?.id}`));
  assert.deepEqual((report?.resource as fhir4.Observation).derivedFrom, [{ reference: media?.fullUrl }]);

  const summary = toObservationSummary({ ...observation, id: "9", derivedFrom: [{ reference: "Media/12" }] });
  assert.equal(summary?.photoUrl, "https://oneaquahealth.duckdns.org/photos/12");
  assert.equal(toObservationSummary({ ...observation, id: "9" })?.photoUrl, undefined);
});
