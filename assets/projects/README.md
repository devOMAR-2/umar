# Project screenshots

Put real project screenshots in this folder. Until they exist, the site shows
designed typographic placeholders for each project. Only add images of real
work: no stock photos and no mock-ups of things that don't exist.

## Naming

`<project-slug>-<nn>.<ext>`: lowercase, hyphenated, two-digit index.

```
resume-needed-01.webp
resume-needed-01.avif   (optional, same image as AVIF)
resume-needed-02.webp
```

The slug should match the project's id/slug used in `index.html`.

## Format

- **WebP** is the baseline format. Add **AVIF** as well if you like, using `<picture>`.
- Export at **2400px wide at most** (2x for a ~1200px layout slot). Also export a
  ~1200px version if the image will be used in small cards.
- Crop all screenshots of a project to the **same aspect ratio** (e.g. 16:10).
- Aim for less than ~250 KB per file. Strip metadata.

## In HTML

Always set intrinsic `width` and `height` (this prevents layout shift), plus a
meaningful Arabic `alt`, and lazy-load anything below the fold:

```html
<picture>
  <source srcset="assets/projects/resume-needed-01.avif" type="image/avif">
  <img src="assets/projects/resume-needed-01.webp"
       width="2400" height="1500"
       alt="…"
       loading="lazy" decoding="async">
</picture>
```
