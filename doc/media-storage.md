# Media Storage (Dev)

## Folders

- `uploads/covers` - uploaded capsule covers (`/static/covers/*`)
- `uploads/tags` - uploaded custom tag images (`/uploads/tags/*`)
- `uploads/chat` - chat images/videos (`/uploads/chat/*`)
- `backend/src/main/resources/static/tags` - bundled system tag images (`/static/tags/*`)

## What you must upload manually

For current demo dataset import (`database/scripts/import_datasets.js`):

- No manual cover files are required.
- Demo capsules use existing bundled files from `/static/tags/*`.

## Optional legacy cover files

If your old DB records still reference `/static/covers/*.jpg`, put files with these names into `uploads/covers`:

- `kyiv-dawn.jpg`
- `release.jpg`
- `winter-album.jpg`
- `recipes.jpg`
- `roadtrip.jpg`
- `startup.jpg`
- `letters.jpg`
- `marathon.jpg`
- `music.jpg`
- `open-memories.jpg`
- `graduation.jpg`
- `wedding.jpg`

Tip: for quick local fallback you can copy any suitable images from `backend/src/main/resources/static/tags` and rename them to the names above.

