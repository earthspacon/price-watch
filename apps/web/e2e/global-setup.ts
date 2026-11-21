import { E2E_PORT, FAKE_STORE_PORT } from "./config";
import { startFakeStore, type RunningFakeStore } from "./fake-store";
import { startWorker, type RunningWorker } from "./worker";

let fakeStore: RunningFakeStore | null = null;
let worker: RunningWorker | null = null;

export async function setup() {
  fakeStore = await startFakeStore({ port: FAKE_STORE_PORT });
  worker = await startWorker({ port: E2E_PORT });
}

export async function teardown() {
  worker?.stop();
  await fakeStore?.stop();
}
