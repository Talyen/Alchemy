const { app } = require("electron");

const profile = process.env.ALCHEMY_ELECTRON_TEST_PROFILE;
if (!profile) throw new Error("Electron tests require an isolated profile");
// Run before desktop/main.cjs captures its save paths or creates a browser session.
app.setPath("userData", profile);
app.setPath("sessionData", profile);
