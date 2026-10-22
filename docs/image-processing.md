# System image processing

[Architecture](architecture.md) · [Testing](../test/TESTING.md)

`ImageProcessingModule` exports `ImageProcessingService` and is also re-exported
by `SystemModule`. Consumers may import the standalone module without initializing
storage or a database. The service transforms buffers; it does not read files,
upload objects, create records, select domain presets, or delete originals.

## Contract

`process(input: Buffer, options?: ImageProcessingOptions)` returns a new WebP
buffer with actual `width`, `height`, `sizeBytes`, `format: 'webp'`,
`mimeType: 'image/webp'`, and `extension: '.webp'`. Treat these output values as the
storage metadata, not the original upload's extension, MIME type, or byte count.
The caller's buffer is copied before queueing and is never modified.

PNG, JPEG, GIF, and WebP raster signatures are accepted. Empty, corrupt, and
unsupported input is rejected. This does not change the existing API upload
allowlist or replace multipart/MIME validation.

All output is auto-oriented, converted to sRGB, and encoded without copied
EXIF/GPS/XMP/ICC metadata. Animation is rejected by default; `animation:
'first-frame'` explicitly permits a static derivative. Preserving animation is not
supported. No derivative is silently uploaded or persisted.

APNG is explicitly rejected in both animation modes: the decoder does not offer
the same frame semantics as GIF/WebP, so the service does not silently flatten it.

## Options and defaults

- Omit `resize` to retain oriented dimensions and only re-encode.
- `resize.width` and/or `resize.height` accept positive integer pixels.
- `fit` is `cover` (default), `contain`, `inside`, or `outside`; stretching is not exposed.
- `position` is `center` (default) or a compass direction such as `north` or `west`.
- `allowEnlargement` defaults to false. Exact-size presets must explicitly allow
  enlargement if smaller sources must reach the requested dimensions.
- WebP defaults: quality 80, alpha quality 100, effort 4, lossless false. Settings
  are format-specific; no fixed file-size or quality improvement is guaranteed.
- Transparency is retained unless `flatten: true` is supplied. `background`
  accepts opaque `#RGB` or `#RRGGBB` and defaults to white for padding/flattening.

The media domain defines `avatarProcessingPolicy` for avatar uploads:

```ts
await processor.process(buffer, avatarProcessingPolicy);
```

These are server-owned options, not an arbitrary client-controlled Sharp API.
Features own their presets. Generate future variants from the same input rather
than repeatedly recompressing earlier lossy derivatives.

The avatar policy center-crops to exactly 256×256 without stretching, enlarges
small inputs, preserves transparency, and uses the processor's WebP encoding
defaults. Orientation correction is always applied by the processor. Animated
GIF uploads yield only their first frame, so stored derivatives are static;
APNG remains unsupported.

The upload pipe always checks bytes, supported signatures, and declared MIME
type. Avatar routes set `processing: true` to defer pixel validation to their
mandatory transformation, avoiding a separate full corruption-check decode.
Request fingerprinting and the image service reuse the cached input buffer.
The processor checks dimensions and pixel limits and rejects corrupt image data
before storage. Only the resulting WebP is uploaded, with actual output metadata.
Routes without processing retain the default full-validation decode, including
article uploads. The flag must only be used when downstream processing is required.

## Resource and failure policy

`src/config/image-processing.config.ts` defines input/output byte and pixel
limits, maximum dimensions, and the Sharp processing timeout. Defaults use the
existing upload byte/pixel bounds, 10 processing seconds, two active jobs and four
queued jobs per service instance. A full queue fails immediately. Capacity is
released after success or failure; this is an in-process bound, not a cluster-wide
queue, hard memory sandbox, or HTTP request deadline. Sharp's timeout applies to
its processing, not time spent waiting for a permit. Output bytes are checked
after encoding; dimensions are also estimated before proportional/outside resize.

Failures use transport-independent `ImageProcessingError` codes:
`invalid_input`, `invalid_options`, `limit_exceeded`, `unsupported_animation`,
`processing_failed`, and `busy`. Raw decoder errors are not exposed. Callers own
HTTP/worker error mapping, retries, transaction deadlines, and storage lifecycle.

## Rollout boundary

New avatar uploads and replacements use the policy; existing avatars remain
untouched. Hero/article uploads remain unprocessed. No request/response shape,
database schema, or accepted upload format changes are required. Existing avatar
audits, transactions, idempotency, and durable storage cleanup remain in place;
processing itself does not emit a separate audit. Existing-image backfill is a
separate optional operation.

## Verification and recovery

The policy/processor tests cover portrait, landscape, square, and undersized
images, center cropping, EXIF orientation, transparency, static GIF output,
corrupt input, pixel/output limits, capacity bounds, and decoder/encoder failures.
Media-service tests cover WebP metadata, temporary-file removal, attachment and
database failures, and rollback compensation. Profile E2E tests exercise corrupt
and failed processing, capacity rejection, uncertain storage PUTs, audit and
cleanup-intent rollback, duplicate/concurrent keys, and exhausted cleanup retries.
Article E2E coverage verifies that hero bytes and metadata remain original.

Processing failures must not upload an object or alter the current avatar/audit.
A full processor returns `503`; invalid/corrupt/unsupported images return `400`.
After a failed request, retry with the same idempotency key; successful retries
replay without another transformation, PUT, or audit. Failures after uploading
use the existing durable abandonment/reconciliation path; old avatars remain
referenced on rollback. A committed replacement is not rolled back if old-object
cleanup fails: its durable intent follows the existing retry/DLQ contract.

Deploy normally with no migration or new dependency. Existing avatars and API
shapes remain unchanged; only new avatar assignments and replacements become
256×256 WebP. Reverting the application does not rewrite stored WebP avatars.
