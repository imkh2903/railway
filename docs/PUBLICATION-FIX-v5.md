# Publication Fix v5

## Root cause found

The admin editor allowed a publication to have `status=published` while `publishAt` contained a future datetime. The public API correctly interpreted that future datetime as scheduled and hid the article, while the admin table still displayed `published`.

This produced the exact symptom: the admin showed a published Warta, but `/api/publications` returned an empty list.

## Fix

- Added explicit `publishMode`: `immediate` or `scheduled`.
- Existing legacy `published` records without `publishMode` are migrated to `immediate` and their stale/future `publishAt` is cleared.
- The editor now has a dedicated **Jadwalkan publikasi** switch.
- `Simpan & Publish` without scheduling always publishes immediately.
- Scheduled publications remain hidden until their scheduled time.
- Admin status shows `scheduled` when a future scheduled publication is waiting.
- `publishedAt` is only set when the article is actually public.
- POST publication now validates media/document references before writing.
- Public listing uses an explicit DOM reference for the filter controls.

## After updating

Restart the server:

```bash
npm start
```

The startup migration runs automatically against `data/db.json`. No manual database conversion is required.

## Expected result

A Warta saved as Published with no scheduling will appear immediately at:

`/publikasi.html`

A Warta with **Jadwalkan publikasi** enabled will show as `scheduled` in admin and become public only at the selected time.
