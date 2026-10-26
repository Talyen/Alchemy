# Labyrinth map UI

Shared conventions: [UI](./UI.md).

## Labyrinth map

The complete twenty-room floor fits below the stationary Labyrinth header in
rows of 4 / 6 / 6 / 4. There is no Floor N subheader; the floor number is the
map region's accessible description.
Equal 4:3 full-bleed art tiles maximize their size against both available
dimensions, with narrow gutters and room for 106% hover enlargement. Positions
stay fixed during discovery and destination return. There is no
scrolling, zoom toolbar, legend, corridor, visible room label, or location dot.

Undiscovered rooms use six generic fog-of-war illustrations, selected by a stable
hash of node identity independently of encounter type and gameplay RNG. No hidden
encounter art, category, Trait, accessible name, or hover theme is exposed. Discovery
crossfades the fog into the actual artwork over 260ms, retaining opaque fog beneath
the incoming image until the reveal completes. Reachable rooms also crossfade when
the map remounts after a room visit; completed rooms and the always-visible boss
retain their existing treatment. The crossfade waits for screen artwork readiness.
Reduced motion shows the artwork immediately. Actual Mystery encounters reveal
their existing art. The boss is always visible and inspectable, with the shared
display label Boss and a persistent red glow independent of hover.
All rooms rest with the standard dim `border-border/80` frame, except the current
room's thicker `border-primary` amber frame. Reachability does not change border color.
Unentered rooms are slightly dimmed and desaturated, with a stronger treatment
for undiscovered fog art. The current room shows the active hero's full-color
portrait, cropped toward the face in the 4:3 tile.
Shared hover and focus keep shimmer and Shine Border with the same
hidden resting frame and emphasized border width as other artwork tiles; unknown
interactions stay neutral. Room-specific shine colors stay bright enough to remain
visible throughout the animation. Earlier completed rooms remain grayscale and
subdued from their first frame, including during the opacity reveal and route returns.

Hovering or keyboard-focusing a revealed room shows a passive shared tooltip with
only its encounter name, native enemy Traits, and combat/reward modifiers. It
uses the standard tooltip placement, scaling and dismissal behavior, preferring
the side of the tile. No artwork, category eyebrow, action footer or inspect
panel is repeated. The current hero node and undiscovered rooms show no tooltip.
Current location remains accessible through `aria-current="location"`.

Clicking, tapping or keyboard-activating an unfinished reachable room enters it
immediately through the existing room-entry command. A room is reachable when
adjacent to any completed room; there is no walking or backtracking requirement.
Hidden, distant and completed non-boss rooms do not activate. Activating a
completed boss descends immediately, including from the current hero node, and
leaves unfinished rooms behind. Hover and focus never change completion or location.
Reduced motion freezes emphasis and shine.
