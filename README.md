# SMILES Presentation

A tiny HTML/JS player for slide-by-slide lessons (with optional audio) that you can also zip as **SCORM 1.2**.

## What’s inside

```
audio/   slide1.mp3, slide2.mp3, ...
css/     styles
img/     images used by slides
js/      driver.js, configuration.js
slides/  slide1.html, slide2.html, ...
index.html
imsmanifest.xml  (for SCORM)
scorm.js
```

## Run locally

```bash
# from the project folder
python -m http.server 8000
# then open http://localhost:8000
```

(Any static server works.)

## Add slides (and audio)

1. Create your slide files in `slides/` → `slide1.html`, `slide2.html`, …
2. (Optional) Add narration in `audio/` → `slide1.mp3`, `slide2.mp3`, …
3. If present, edit `js/configuration.js` to list slides in order.
4. Put images in `img/` and reference them from your slide HTML.

**Pairing rule:** `slides/slideN.html` ↔ `audio/slideN.mp3` (same number).

## Controls

* Next / Prev: **→ / ←** (Space/Enter also work)
* On-screen audio toggle (autoplay may require one click first)

## Export as SCORM (1.2)

1. Ensure `imsmanifest.xml` points to `index.html`.
2. Zip **everything** so `imsmanifest.xml` is at the **root**:

   ```bash
   zip -r smiles-presentation_scorm.zip .
   ```
3. Upload the zip to your LMS as SCORM 1.2.

## License & Credits

* MIT License
* Maintainer: **Crtomir Podlipnik**.


