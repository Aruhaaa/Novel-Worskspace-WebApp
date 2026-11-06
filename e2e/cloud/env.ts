// Ports of the cloud tests (playwright.cloud.config.ts). Chosen not to collide with the usual dev servers.
export const LITE_PORT = 54331;
export const LITE_BARE_PORT = 54332;
export const APP_PORT = 5182;
export const APP_BARE_PORT = 5183;
// The stand-in that has the earlier setup scripts but NOT the chapter publishing one (a website update that comes before the database update)
export const LITE_PRE_PORT = 54333;
export const APP_PRE_PORT = 5184;
