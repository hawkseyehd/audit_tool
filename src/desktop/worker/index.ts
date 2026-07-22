import { workerRequestSchema, type WorkerResponse } from "../shared/worker-contracts.js";

const parentPort = process.parentPort;

parentPort.on("message", (event) => {
  const parsed = workerRequestSchema.safeParse(event.data);
  if (!parsed.success) return;

  let response: WorkerResponse;
  if (parsed.data.type === "ping") {
    response = { id: parsed.data.id, type: "pong" };
  } else {
    response = { id: parsed.data.id, type: "stopped" };
  }
  parentPort.postMessage(response);

  if (parsed.data.type === "shutdown") {
    setImmediate(() => process.exit(0));
  }
});
