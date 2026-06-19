import "@playwright/test";

declare module "@playwright/test" {
  interface Page {
    alchemyDesktop?: Window["alchemyDesktop"];
  }
}
