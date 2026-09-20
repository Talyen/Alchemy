# Labyrinth map UI

Shared conventions: [UI](./UI.md).

## Labyrinth map

The complete twenty-room floor fits below the stationary Labyrinth header in
rows of 4 / 6 / 6 / 4. There is no Floor N subheader; the floor number is the
Entrance inspector's eyebrow and the map region's accessible description.
Equal 4:3 full-bleed art tiles maximize their size against both available
dimensions, with narrow gutters and room for 106% hover enlargement. Positions
stay fixed during discovery, selection, and destination return. There is no
scrolling, zoom toolbar, legend, corridor, visible room label, or location dot.

Undiscovered rooms use six generic fog-of-war illustrations, selected by a stable
hash of node identity independently of encounter type and gameplay RNG. No hidden
encounter art, category, Trait, accessible name, or hover theme is exposed. Discovery
replaces the fog with the actual artwork and plays the reveal. Actual Mystery encounters reveal
their existing art. The boss is always visible and inspectable, with the shared
display label Boss and a persistent red glow independent of hover/selection.
All rooms rest with the standard dim `border-border/80` frame, except the current
room's shared `border-primary` amber. Reachability does not change border color.
Shared hover, focus, and selection keep shimmer and Shine Border; unknown
interactions stay neutral. Completed art remains grayscale and subdued from
its first frame, including during the opacity reveal and route returns.

Clicking or keyboard-activating a discovered room opens its inspector. An
unfinished room offers its action when adjacent to any completed room; there
is no explicit walking action or backtracking requirement. Inspection never
changes completion or location. Current location remains accessible through
`aria-current="location"`. Reduced motion freezes emphasis and shine.

One inspector floats beside the selected tile without reserving a sidebar or
resizing the grid. It prefers right, then left, top, or bottom, with a 10px gap
and 8px boundary padding. Its width is 320–420 rendered pixels, capped to the
viewport; width and node-gap limits compensate for virtual-stage scale.
Outside clicks dismiss it, another inspectable node switches inspection, and
Escape dismisses and restores focus. Floor changes dismiss old selection.

The inspector retains natural-aspect artwork, the category/name overlay, shared
unboxed Trait rows, and a pinned action footer while details scroll. Inaccessible
rooms omit the action footer and adjacency instructions. A completed boss offers
Descend regardless of the last completed location, reporting rooms left behind.
Combat, services, and rewards retain their existing actions.
