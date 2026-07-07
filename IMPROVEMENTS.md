# Where this portfolio could go next

The site is well built, but its shape is the standard one: metrics strip, five project cards, skill bars, anonymous testimonials, cert grid. Every data-scientist portfolio has this shape. Your own PRODUCT.md points somewhere better ("researcher first", "earned numbers only", "geography is identity"). The alternative below takes those principles to their conclusion.

## The idea: a field dossier, not a landing page

**Three case dossiers instead of five cards.** Problem, method, the one number, and who acted on it. The current five cards overlap — the supply-chain model, the dashboard, and the time-series paper are all facets of the same vanilla work. Merge them into one deep vanilla dossier (18% MAE, the ScienceDirect paper, the workshop photo, the interactive chart), keep the USAID SITES pipeline as the second (6 weeks to under 10 days), and the ETL warehouse as the third. Each dossier carries exactly one artifact. Thin cards disappear; the remaining three get room to be convincing.

**Drop the skill percentage bars.** "Python 90%" is a number nobody can check, on a site whose own design principles say earned numbers only. A plain tool list works harder if each tool links to the dossier where it did the work. A tool earns its chip by appearing in a project.

**Swap the fraud demo for something only you could show.** A synthetic fraud scatter could be on anyone's portfolio. An interactive map of the NASA POWER grid cells against the ground stations from the vanilla model would show the same D3 skill and be unmistakably yours. Same effort, no substitute exists.

**Lead with the verifiable.** The publication is the strongest object on the page. Put the journal name, DOI, and date up front in the projects section, not at the bottom of a card. If you can get one named, attributable quote, it replaces all three anonymous testimonials.

## Technical punch list

- Precompile Tailwind instead of loading the CDN script — the CDN build warns in console and generates styles at runtime.
- Rename `Vanilla Workshop.JPG` to `vanilla-workshop.jpg`; spaces and uppercase extensions cause problems on case-sensitive hosts.
- Add `width`/`height` attributes to images to stop layout shift.
- Create a real 1200×630 social preview image. `og:image` now points to `photo.jpg`, which exists but isn't sized for link previews.
- Add a honeypot field to the contact form. The Formspree ID is public, and public endpoints tend to collect bot submissions.
