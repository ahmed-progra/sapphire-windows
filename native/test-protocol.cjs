// Read-only native integration checks. Never change the user's applications or devices.
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

async function main() {
  const executable = path.join(__dirname, 'publish', 'win-x64', 'Sapphire.Native.exe');
  for (const argument of ['--self-test', '--window-self-test', '--audio-self-test']) {
    const result = spawnSync(executable, [argument], { encoding: 'utf8', windowsHide: true, env: { ...process.env, DOTNET_ROOT: path.join(__dirname, 'nonexistent-runtime') } });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const data = JSON.parse(result.stdout.trim());
    assert.equal(data.ok, true);
    if (argument === '--self-test') assert.ok(data.runtimePath.toLowerCase().startsWith(path.join(__dirname, 'publish').toLowerCase()), 'Runtime must load from the bundled output');
    console.log(JSON.stringify({ test: argument, ...data }));
  }
  const child = spawn(executable, [`--parent-pid=${process.pid}`], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const pending = new Map();
  let nextId = 0;
  const output = readline.createInterface({ input: child.stdout });
  output.on('line', line => {
    const response = JSON.parse(line);
    if (response.event === 'foreground-changed') { assert.deepEqual(response, {event:'foreground-changed'}); return; }
    const entry = pending.get(response.id);
    assert.ok(entry, 'Unexpected response ID');
    pending.delete(response.id);
    clearTimeout(entry.timeout);
    entry.resolve(response);
  });
  function call(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 45000);
      pending.set(id, { resolve, timeout });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  let checks = 0;
  try {
    const invalid = [
      ['unsupported.command', {}, 'unsupported_method'],
      ['audio.volume', { id: 'not-a-live-session', volume: 2 }, 'invalid_request'],
      ['audio.deviceVolume', { id: 'not-a-live-device', volume: '0.5' }, 'invalid_request'],
      ['audio.volume', { id: 'not-a-live-session', volume: 0.5 }, 'not_found'],
      ['audio.deviceVolume', { id: 'not-a-live-device', volume: 0.5 }, 'not_found'],
      ['snap.apply', { layout: 'shell.exe' }, 'invalid_request'],
      ['brightness.set', { value: -1 }, 'invalid_request'],
      ['hello.verify', { windowHandle: '0' }, 'invalid_request'],
      ['media.control', { action: 'execute' }, 'invalid_request'],
    ];
    for (const [method, params, code] of invalid) {
      const response = await call(method, params);
      assert.equal(response.error?.code, code, JSON.stringify(response));
      checks++;
    }
    for (const method of ['native.capabilities', 'battery.get', 'audio.get', 'media.get', 'brightness.get', 'bluetooth.list', 'hello.availability', 'notifications.list']) {
      const response = await call(method);
      if (method === 'native.capabilities') {
        assert.ok(response.result, JSON.stringify(response));
        for (const key of ['media', 'audio', 'snap', 'brightness', 'battery', 'bluetooth', 'hello', 'notifications']) assert.equal(typeof response.result[key]?.available, 'boolean', key);
      }
      if (method === 'battery.get') {
        assert.equal(typeof response.result.available, 'boolean');
        assert.ok(response.result.percent === null || (response.result.percent >= 0 && response.result.percent <= 100));
      }
      if (method === 'hello.availability' && response.result) {
        assert.equal(typeof response.result.available, 'boolean');
        assert.ok(response.result.faceEnrolled === null || typeof response.result.faceEnrolled === 'boolean');
        assert.ok(response.result.biometricsDisabledByPolicy === null || typeof response.result.biometricsDisabledByPolicy === 'boolean');
      }
      if (method === 'audio.get' && response.result) {
        assert.ok(Array.isArray(response.result.sessions));
        assert.ok(Array.isArray(response.result.devices));
        for (const value of [...response.result.sessions, ...response.result.devices]) {
          assert.ok(value.volume >= 0 && value.volume <= 1);
          assert.equal(typeof value.isMuted, 'boolean');
        }
      }
      // Avoid logging media titles, device identifiers, notification content, or other personal data.
      const summary = method === 'native.capabilities' ? response.result : response.error
        ? { code: response.error.code, message: response.error.message }
        : method === 'audio.get' ? { sessions: response.result.sessions.length, devices: response.result.devices.length }
        : method === 'bluetooth.list' ? { devices: response.result.length }
        : method === 'media.get' ? { activeSession: response.result !== null }
        : method === 'notifications.list' ? { notifications: response.result.length }
        : response.result;
      console.log(JSON.stringify({ test: method, outcome: response.error ? 'unavailable' : 'ok', summary }));
      checks++;
    }
    child.stdin.end();
    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Helper did not exit after stdin closed')), 5000);
      child.on('exit', code => { clearTimeout(timeout); resolve(code); });
    });
    assert.equal(exitCode, 0);
    console.log(JSON.stringify({ ok: true, protocolChecks: checks, cleanShutdown: true }));
  } finally {
    for (const entry of pending.values()) clearTimeout(entry.timeout);
    child.kill();
    output.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
