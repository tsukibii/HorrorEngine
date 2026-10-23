# The studio view (`tools/shared/studioview.js`)

A reusable component: any three.js page gets a white studio, light from an HDR, one key light with soft shadows, a floor that
only shows the shadow, and filmic tone mapping. Not a path tracer: a quick idea of how a model reads in a lit render.

```js
import { StudioView } from "/shared/studioview.js";      // the page's import map must have "three"
const studio = new StudioView({ renderer, scene, hide: [pageFloor], floorY: 0 });
studio.mountUI(document.querySelector("#studio"));       // a checkbox and sliders, remembered in localStorage
studio.set(true);                                         // or toggle(); onChange(fn) tells you
// in the render loop, before render():  studio.tick();   // picks up meshes added later (hair, clothes) and a moved model
```
- While on it hides the scene's other lights and `hide`, and puts the background, environment, tone mapping, shadow maps and the
  materials' environment strength back when off.
- Settings: exposure, studio light (the HDR's strength), key light and its angle, shadow strength, background (white, light
  grey, the HDR blurred).
- The servers (`tools/character/serve.py`, `tools/director/serve.py`) serve `/shared/<file>` (tools/shared) and `/env/<file>`
  (Content/Studio/Env); `/vendor/RGBELoader.js` is vendored. A new server needs the same two routes.
- Wired into the Character Studio: a **Studio** button over the view and a View panel in the Body tab.
- The floor is seen edge-on from a low camera: tilt the view down to see the shadow. A key angle behind the model hides it.
