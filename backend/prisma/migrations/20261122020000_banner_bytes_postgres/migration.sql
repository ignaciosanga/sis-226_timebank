-- Incremental: conserva ofertas, IDs y referencias de bases pobladas.
-- NULL permite recuperar archivos anteriores sin inventar bytes perdidos.
BEGIN;
ALTER TABLE "BANNERS_TUTORIA" ADD COLUMN content_bytes bytea;
ALTER TABLE "BANNERS_TUTORIA"
  ADD CONSTRAINT "BANNERS_TUTORIA_content_integrity" CHECK (
    content_bytes IS NULL OR (
      octet_length(content_bytes) = byte_size
      AND encode(sha256(content_bytes), 'hex') = sha256
    )
  );
COMMIT;
