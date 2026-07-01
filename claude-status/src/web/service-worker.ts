/* eslint-disable */
const swSelf: any = self;

swSelf.addEventListener("install", () => {
  swSelf.skipWaiting();
});

swSelf.addEventListener("activate", () => {
  swSelf.clients.claim();
});

swSelf.addEventListener("fetch", () => {
  // pass-through
});
