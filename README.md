# Decentralised XR Webapp Template

Built with React, Three.js & IPFS.

Run a node in a network of peers on a desktop, mobile or browser.

## Snowpack

`yarn start`

`yarn build`

## Capacitor

First build then

- open in electron

`npx cap open @capacitor-community/electron`

- update electron build 

`npx cap sync @capacitor-community/electron`



## To Do

- [x] Offscreen canvas
- [ ] assign all `window` and `document` and add return promises
- [ ] polyfill media
- [ ] Worker WASM loader
- [ ] PhysX
- [ ] IPFS networking

## Adapting a threejs project

- Call `createWorker(canvas)` to create a worker and receive a proxy object.
- Receive the worker with `receiveWorker(callback: ({ canvas, width, height, pixelRatio, }))`
- All references to `renderer.domElement` become `window` or `proxy`
- All function calls to `proxy`, `window` or `document` return promises that resolve to their original return values