import assert from "node:assert/strict";
import test from "node:test";

process.env.CLOUDINARY_URL ??= "cloudinary://unit_key:unit_secret@unit_cloud";

const { sniffMedicalFile } = await import("../../src/utils/fileSignature.js");
const {
  default: SecureMedicalFileService,
  isAllowedMedicalFileUrl,
  signAuthenticatedMedicalUrl,
} = await import("../../src/services/secureMedicalFile.service.js");

test("file type is taken from the real content, not from the declared type", () => {
  assert.equal(sniffMedicalFile(Buffer.from("%PDF-1.7\n..."))?.mime, "application/pdf");
  assert.equal(sniffMedicalFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.extension, "jpg");
  assert.equal(
    sniffMedicalFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mime,
    "image/png",
  );
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
  assert.equal(sniffMedicalFile(webp)?.extension, "webp");

  // Tệp thực thi, HTML, SVG, tệp rỗng và RIFF không phải WebP đều bị từ chối.
  for (const bad of [
    Buffer.from("MZ\x90\x00"),
    Buffer.from("<html><script>alert(1)</script>"),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.alloc(0),
    Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt ")]),
  ]) {
    assert.equal(sniffMedicalFile(bad), null);
  }
});

test("only https links to the allowed storage host are accepted", () => {
  assert.equal(isAllowedMedicalFileUrl("https://res.cloudinary.com/demo/raw/upload/a.pdf"), true);
  assert.equal(isAllowedMedicalFileUrl("http://res.cloudinary.com/demo/raw/upload/a.pdf"), false);
  assert.equal(isAllowedMedicalFileUrl("https://evil.example/a.pdf"), false);
  assert.equal(isAllowedMedicalFileUrl("https://res.cloudinary.com.evil.example/a.pdf"), false);
  assert.equal(isAllowedMedicalFileUrl("khong phai url"), false);
});

test("private result links are signed when read, public links are left untouched", () => {
  const privateUrl = new URL(
    "https://res.cloudinary.com/unit_cloud/raw/authenticated/v1700000000/hospital/medical-results/abc.pdf",
  );
  const signed = signAuthenticatedMedicalUrl(privateUrl);
  assert.match(signed.pathname, /^\/[^/]+\/raw\/authenticated\/s--[^/]+--\/v1700000000\/hospital\/medical-results\/abc\.pdf$/);

  // Ký lại một đường dẫn đã có chữ ký vẫn cho cùng một kết quả hợp lệ.
  assert.equal(signAuthenticatedMedicalUrl(signed).pathname, signed.pathname);

  const publicUrl = new URL("https://res.cloudinary.com/unit_cloud/image/upload/v1/hospital/x.png");
  assert.equal(signAuthenticatedMedicalUrl(publicUrl).href, publicUrl.href);
});

test("verified medical files are streamed without buffering the whole response", async () => {
  const originalFetch = globalThis.fetch;
  const chunks = [Buffer.from("%PDF-1.7\nabc"), Buffer.from("noi-dung-ket-qua")];
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "application/octet-stream" } },
    )) as typeof fetch;

  try {
    const file = await SecureMedicalFileService.fetch(
      "https://res.cloudinary.com/unit_cloud/raw/upload/v1/result.pdf",
    );
    assert.equal(file.contentType, "application/pdf");
    assert.equal(file.extension, "pdf");

    const received: Buffer[] = [];
    for await (const chunk of file.stream) received.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(received), Buffer.concat(chunks));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streamed medical files are stopped when their real size exceeds the limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalMaxBytes = process.env.MEDICAL_FILE_MAX_BYTES;
  process.env.MEDICAL_FILE_MAX_BYTES = "12";
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("%PDF-1.7\nabc"));
          controller.enqueue(new TextEncoder().encode("x"));
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "application/octet-stream" } },
    )) as typeof fetch;

  try {
    const file = await SecureMedicalFileService.fetch(
      "https://res.cloudinary.com/unit_cloud/raw/upload/v1/result.pdf",
    );
    await assert.rejects(
      async () => {
        for await (const _chunk of file.stream) {
          // Tiêu thụ luồng để kiểm tra giới hạn cả khi nơi lưu không khai báo Content-Length.
        }
      },
      /vượt quá giới hạn/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMaxBytes === undefined) delete process.env.MEDICAL_FILE_MAX_BYTES;
    else process.env.MEDICAL_FILE_MAX_BYTES = originalMaxBytes;
  }
});
