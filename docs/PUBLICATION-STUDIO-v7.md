# Publication Studio v7

## Critical fix

The v6 admin editor referenced `validClientUrl()` from `refreshEditorChecklist()` and `savePubEditor()` without defining the function. This caused a `ReferenceError` during editor initialization and on input/change events, which made the Save Draft / Save & Publish workflow appear broken.

### Fix

`public/js/admin.js` now defines `validClientUrl(value)` before Publication Studio functions. It accepts only absolute `http://` and `https://` URLs and safely returns `false` for empty/invalid values.

### Expected flow

1. Open Manajemen Publikasi.
2. Click Tambah Publikasi or Edit.
3. Checklist renders without a console exception.
4. Changing thumbnail/type/schedule fields continues to update the checklist.
5. `Simpan Draft` calls `POST/PUT /api/publications`.
6. `Simpan & Publish` calls `POST/PUT /api/publications` with `status=published`.

This fix is intentionally small and isolated so it does not change the backend publication contract.
