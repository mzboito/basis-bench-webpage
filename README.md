# BASIS-Bench project website

Static project page for **“Personalization Without Stereotyping: Do Speech LLMs Know When to Turn a Deaf Ear?”** — no build step, no external dependencies. Everything is plain HTML/CSS/JS, so it hosts directly on GitHub Pages.

## Structure

```
index.html              the whole page
static/css/main.css     styles (light + dark theme)
static/js/data.js       all plotted numbers (Fig. 2 / Tables 4–5) + dataset examples
static/js/plots.js      scatter-chart engine (animated mode transitions, tooltips, Pareto frontier)
static/js/main.js       page wiring: controls, legend, table views, example cards, audio
static/audio/*.mp3      26 example clips converted from the data release (~1.2 MB total)
.nojekyll               tells GitHub Pages to serve files as-is
```

## Deploy on GitHub Pages

1. Push this folder to a repository (either as the repo root, or in a `docs/` folder).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → pick the branch and `/ (root)` (or `/docs`).
3. The site appears at `https://<user>.github.io/<repo>/`.

Everything is relative-path based, so it works from any subpath.

## Remaining TODOs

Search `index.html` for `TODO`:

- **Hero buttons**: Paper / Code / Data are greyed-out `<span class="btn tbd">` placeholders — turn each back into `<a class="btn" href="…">` and drop the `TBD` tag when its link exists.
- **Venue badge**: currently “arXiv preprint · TBD”.
- **BibTeX**: replace the `TBD` eprint/url once the paper is online.

## Updating the numbers

All plotted values live in `static/js/data.js` in the same model order as the plotting
scripts (`Qwen3-Omni, Qwen2.5-Omni, MOSS-Audio, Step-Audio2, DeSTA2.5-Audio, AF-3, Voxtral,
AF-Next`). `tradeoff.{gender,age}.{bias,pers}` holds the four evaluation modes
(overall + per-group); `robustness` holds the content-task and classification scores.
Axis ranges (`xDomain`/`yDomain`) are fixed per chart so that dot movement between modes is
comparable — adjust them there if values change.

## Audio examples

The clips in `static/audio/` were converted from the data release with:

```bash
ffmpeg -i <src.wav> -ac 1 -codec:a libmp3lame -b:a 96k <dst.mp3>
```

Sources: `BASIS_health_product/{health,product}/{Ono_Anna,Vivian,Aiden}/audios/*.wav`,
`ELIP_Pair/audio/adult_child_echomind_cloned_audio/female_{adult,child}_idx{0,1,2}.wav`,
`SpokenSS_plus/audio/original_data/{age,gender}/*.wav`.
To swap in different examples, convert the clip, drop it in `static/audio/`, and edit the
`EXAMPLES` object in `static/js/data.js`.

## A note on chart colors

The website does **not** reuse the matplotlib palette from the paper: two of its pairs are
nearly indistinguishable on screen (e.g. `#F2A541` vs `#D4B106`), including under
color-vision deficiency. Each model is instead mapped to the closest hue of a validated
8-color categorical palette (with separate steps for dark mode), and every value is also
reachable via tooltips and the “View as table” toggle.

## Cache busting

`index.html` loads the CSS/JS as `…?v=11`. Bump that number whenever you change a file in
`static/`, so visitors' browsers fetch the new version instead of a cached one.
