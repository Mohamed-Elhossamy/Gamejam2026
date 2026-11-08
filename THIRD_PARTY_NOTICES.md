# Third-party notices

## Music

`server/assets/grand-dark-waltz-allegro.mp3`

"Grand Dark Waltz Allegro" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/

## Sound effects

The event sounds in `web/src/game/eventAudio.ts` are streamed at runtime from myinstants.com. They are not stored in this repository and remain the property of their respective owners.

## "You died" lettering

`web/src/assets/you-died-lettering.svg`

- Source typeface: Pricedown Black by Ray Larabie / Typodermic Fonts, downloaded from 1001fonts.com (pricedown.zip), which bundles the Typodermic Desktop EULA 2026.
- The EULA (s4.3) forbids embedding the font in a website or as a webfont, so the font file is not shipped. The words "you died" were converted once to static vector outlines (fontTools, unmodified letterforms) and saved as SVG artwork. The EULA allows outlined or rasterised artwork; confirm with Typodermic before any commercial release.
- Fill: #c8102e.

## Fonts and libraries

- Fraunces, Bricolage Grotesque, Spline Sans Mono, Cinzel and Cormorant Garamond are loaded from Google Fonts (SIL Open Font License).
- KaTeX (MIT) renders the maths notation and ships its own fonts.
- npm dependencies are listed in each `package.json` and keep their own licences.
