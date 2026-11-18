-- Tìm kiếm công khai bằng full-text của Postgres.
-- SearchDocument là view vật chất gom chuyên khoa, bác sĩ, gói khám và hỏi đáp thành một bảng tìm kiếm duy nhất, đã bỏ dấu
-- (giống foldVietnamese) và có tsvector theo trọng số (tiêu đề A, từ khóa B, nội dung C). Làm mới bằng
-- REFRESH MATERIALIZED VIEW CONCURRENTLY khi quản trị sửa nội dung và định kỳ.

-- Khớp gần đúng (lỗi gõ sai) bằng trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE MATERIALIZED VIEW "SearchDocument" AS

  SELECT
    'department'::text AS "type",
    d."id"::text AS "id",
    d."name" AS "title",
    COALESCE(d."triageDescription", d."description") AS "description",
    d."slug" AS "slug",
    NULL::text AS "category",
    d."image" AS "image",
    NULL::text AS "departmentName",
    NULL::double precision AS "price",
    0 AS "bonus",
    lower(translate(regexp_replace(normalize(COALESCE(d."name", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd')) AS "titleFolded",
    setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(d."name", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'A') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', d."slug", array_to_string(d."symptomKeywords", ' ')), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'B') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', d."description", d."triageDescription"), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'C') AS "searchVector"
  FROM "Department" d
  WHERE d."isActive"

  UNION ALL

  SELECT
    'doctor'::text,
    p."id"::text,
    concat_ws(' ', p."title", u."fullName"),
    COALESCE(p."bio", p."specialization"),
    p."slug",
    NULL::text,
    u."avatar",
    d."name",
    p."consultationFee"::double precision,
    0,
    lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', p."title", u."fullName"), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd')),
    setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', p."title", u."fullName"), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'A') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', p."specialization", d."name"), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'B') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(p."bio", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'C')
  FROM "DoctorProfile" p
  JOIN "User" u ON u."id" = p."userId"
  JOIN "Department" d ON d."id" = p."departmentId"
  WHERE p."isAvailable" AND u."isActive" AND d."isActive"

  UNION ALL

  SELECT
    'package'::text,
    k."id"::text,
    k."name",
    COALESCE(k."summary", k."description"),
    k."slug",
    NULL::text,
    k."image",
    d."name",
    (COALESCE(NULLIF((SELECT SUM(i."price") FROM "PackageItem" i WHERE i."packageId" = k."id" AND i."included"), 0), k."basePrice") + k."serviceFee")::double precision,
    CASE WHEN k."isPopular" THEN 5 ELSE 0 END,
    lower(translate(regexp_replace(normalize(COALESCE(k."name", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd')),
    setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(k."name", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'A') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', k."slug", d."name", (SELECT string_agg(i."name", ' ') FROM "PackageItem" i WHERE i."packageId" = k."id")), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'B') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', k."summary", k."description"), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'C')
  FROM "Package" k
  JOIN "Department" d ON d."id" = k."departmentId"
  WHERE k."isActive" AND d."isActive"

  UNION ALL

  SELECT
    'faq'::text,
    f."id"::text,
    f."question",
    f."answer",
    NULL::text,
    f."category",
    NULL::text,
    NULL::text,
    NULL::double precision,
    0,
    lower(translate(regexp_replace(normalize(COALESCE(f."question", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd')),
    setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(f."question", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'A') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(concat_ws(' ', f."category", array_to_string(f."keywords", ' ')), ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'B') || setweight(to_tsvector('simple', lower(translate(regexp_replace(normalize(COALESCE(f."answer", ''), NFD), '[\u0300-\u036f]', '', 'g'), 'Đđ', 'dd'))), 'C')
  FROM "FAQ" f
  WHERE f."isActive" AND f."showOnWeb"

WITH DATA;

-- Bắt buộc có chỉ mục duy nhất để làm mới CONCURRENTLY (không khóa đọc).
CREATE UNIQUE INDEX "SearchDocument_type_id_key" ON "SearchDocument" ("type", "id");
CREATE INDEX "SearchDocument_searchVector_idx" ON "SearchDocument" USING GIN ("searchVector");
CREATE INDEX "SearchDocument_titleFolded_trgm_idx" ON "SearchDocument" USING GIN ("titleFolded" gin_trgm_ops);
