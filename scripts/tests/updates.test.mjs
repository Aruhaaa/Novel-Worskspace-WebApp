// The desktop app's update logic, run against a pretend updater. The real one needs a published release to talk to,
// which these tests cannot make, so they check what this app does with what an updater says.
//
//   npm run test:unit
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createUpdater, UPDATE_EVENT } from '../../electron/updates.js';

class FakeUpdater extends EventEmitter {
  checks = 0;
  installs = [];
  failWith = null;
  /** What happens when asked to look: a list of [event, payload] */
  script = [['checking-for-update'], ['update-not-available']];
  async checkForUpdates() {
    this.checks++;
    if (this.failWith) throw this.failWith;
    for (const [name, payload] of this.script) this.emit(name, payload);
  }
  quitAndInstall(...args) {
    this.installs.push(args);
  }
}

const make = (overrides = {}) => {
  const autoUpdater = new FakeUpdater();
  const sent = [];
  const updater = createUpdater({ autoUpdater, packaged: true, version: '1.2.3', send: (s) => sent.push(s), ...overrides });
  return { autoUpdater, sent, updater };
};

test('the window is told with a message name the preload also listens for', () => {
  assert.equal(UPDATE_EVENT, 'update:state-changed');
});

test('it downloads by itself and installs when the app is closed', () => {
  const { autoUpdater } = make();
  assert.equal(autoUpdater.autoDownload, true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  assert.equal(autoUpdater.allowPrerelease, false);
});

test('running from source (not installed) there is nothing to update, and it never asks', async () => {
  const { autoUpdater, updater } = make({ packaged: false });
  assert.deepEqual(updater.getState(), { status: 'unavailable' });
  assert.deepEqual(await updater.check(), { status: 'unavailable' });
  assert.equal(autoUpdater.checks, 0);
  const stop = updater.start({ firstAfterMs: 1, everyMs: 1 });
  await new Promise((r) => setTimeout(r, 30));
  stop();
  assert.equal(autoUpdater.checks, 0);
});

test('already up to date says so', async () => {
  const { updater, sent } = make();
  const state = await updater.check();
  assert.equal(state.status, 'current');
  assert.match(state.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(sent.map((s) => s.status), ['checking', 'current']);
});

test('a newer version is downloaded, with progress, and then waits to be installed', async () => {
  const { autoUpdater, updater, sent } = make();
  autoUpdater.script = [
    ['checking-for-update'],
    ['update-available', { version: '1.3.0' }],
    ['download-progress', { percent: 12.4 }],
    ['download-progress', { percent: 99.6 }],
    ['update-downloaded', { version: '1.3.0' }],
  ];
  const state = await updater.check();
  assert.deepEqual(state, { status: 'ready', version: '1.3.0' });
  assert.deepEqual(
    sent.map((s) => [s.status, s.percent]),
    [['checking', undefined], ['downloading', 0], ['downloading', 12], ['downloading', 100], ['ready', undefined]]
  );
  // The new version's number is kept through the download
  assert.equal(sent[2].version, '1.3.0');
});

test('progress outside 0 to 100 is kept inside it', () => {
  const { autoUpdater, updater } = make();
  autoUpdater.emit('update-available', { version: '2.0.0' });
  autoUpdater.emit('download-progress', { percent: 250 });
  assert.equal(updater.getState().percent, 100);
  autoUpdater.emit('download-progress', { percent: -5 });
  assert.equal(updater.getState().percent, 0);
  autoUpdater.emit('download-progress', {});
  assert.equal(updater.getState().percent, 0);
});

test('"Restart now" installs only once a version is ready', async () => {
  const { autoUpdater, updater } = make();
  assert.equal(updater.install(), false);
  assert.equal(autoUpdater.installs.length, 0);

  autoUpdater.script = [['update-available', { version: '1.3.0' }]];
  await updater.check();
  // Still downloading: not yet
  assert.equal(updater.install(), false);
  assert.equal(autoUpdater.installs.length, 0);

  autoUpdater.emit('update-downloaded', { version: '1.3.0' });
  assert.equal(updater.install(), true);
  // Not silent, and the app opens again afterwards
  assert.deepEqual(autoUpdater.installs, [[false, true]]);
});

test('a check that fails is an error state with a short plain message, and does not throw', async () => {
  const { autoUpdater, updater, sent } = make();
  autoUpdater.failWith = new Error('net::ERR_INTERNET_DISCONNECTED\n    at ClientRequest (C:\\Users\\Someone\\AppData\\app.asar\\x.js:1:1)');
  const state = await updater.check();
  assert.equal(state.status, 'error');
  assert.equal(state.message, 'net::ERR_INTERNET_DISCONNECTED');
  assert.equal(sent.filter((s) => s.status === 'error').length, 1);

  // Trying again later works, and clears the error
  autoUpdater.failWith = null;
  const again = await updater.check();
  assert.equal(again.status, 'current');
});

test('an error the updater reports by itself is the same, and a path on this computer is not kept', () => {
  const { autoUpdater, updater } = make();
  autoUpdater.emit('error', new Error('Cannot open C:\\Users\\Someone\\AppData\\Local\\Programs\\app-update.yml'));
  const state = updater.getState();
  assert.equal(state.status, 'error');
  assert.ok(!state.message.includes('Someone'), state.message);
  assert.ok(!state.message.includes('C:'), state.message);
});

test('it does not start a second check while one is under way, or once a version is waiting', async () => {
  const { autoUpdater, updater } = make();
  autoUpdater.emit('checking-for-update');
  await updater.check();
  assert.equal(autoUpdater.checks, 0);

  autoUpdater.emit('update-downloaded', { version: '1.3.0' });
  await updater.check();
  assert.equal(autoUpdater.checks, 0);
  assert.equal(updater.getState().status, 'ready');
});

test('it checks soon after opening and again at the chosen interval, and can be stopped', async () => {
  const { autoUpdater, updater } = make();
  const stop = updater.start({ firstAfterMs: 5, everyMs: 40 });
  await new Promise((r) => setTimeout(r, 120));
  stop();
  const seen = autoUpdater.checks;
  assert.ok(seen >= 2, `expected at least two checks, saw ${seen}`);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(autoUpdater.checks, seen, 'it kept checking after being stopped');
});

test('the version it reports is the one it was given', () => {
  assert.equal(make().updater.getVersion(), '1.2.3');
});
