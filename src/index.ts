import { randomUUID } from "crypto";
import { IncomingMessage, createServer, ServerResponse } from "http";
import {
  createSession,
  updatePrimer,
  findCodeBlocks,
  getResponse,
  runCommands,
  readBody,
} from "./utils.js";
import {
  Issue,
  isIssueActionable,
  isRequestSignatureValid,
  prepareRepository,
  pushAllChanges,
  readIssueDetails,
} from "./gh-issue.js";
import logger from "./file-logger.js";

const historyCache = new Map();
const streams = new Map();
const sendEvent = (uid, eventName, data) => {
  if (!streams.has(uid)) {
    return;
  }

  const stream = streams.get(uid);
  stream.write("event: " + eventName + "\n");
  stream.write("data: " + JSON.stringify(data) + "\n\n");
};

export async function onRequest(
  request: IncomingMessage,
  response: ServerResponse
) {
  if (request.url === "/favicon.ico") {
    response.writeHead(404);
    response.end();
    return;
  }

  const incoming = new URL(
    request.url,
    `http://${request.headers["x-forwarded-for"]}`
  );

  if (incoming.pathname === "/events" && request.method === "GET") {
    const uid = incoming.searchParams.get("uid");

    if (uid) {
      streams.set(uid, response);
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.writeHead(200);
      return;
    }
  }

  if (request.method !== "POST") {
    console.log("Invalid request", String(incoming));
    response.writeHead(404);
    response.end();
    return;
  }

  if (incoming.pathname === "/primer") {
    updatePrimer(await readBody(request));
    response.writeHead(204);
    return;
  }

  if (incoming.pathname === "/issues") {
    const body = await readBody(request);

    logger.debug(body);

    if (
      !isRequestSignatureValid(String(request.headers["x-hub-signature"]), body)
    ) {
      console.log("Invalid signature: " + request.headers["x-hub-signature"]);
      response.writeHead(404);
      response.end();
      return;
    }

    response.writeHead(202);
    response.end();
    processWebhookEvent(JSON.parse(body));
    return;
  }

  if (incoming.pathname !== "/task") {
    response.writeHead(404);
    response.end();
    return;
  }

  const task = await readBody(request);
  const uid = randomUUID();
  response.writeHead(302, {
    "Session-ID": uid,
    Location: `https://${request.headers["x-forwarded-for"]}/events?uid=${uid}`,
  });
  response.end(uid);

  await tryTask(task, uid);
}

async function processWebhookEvent(event: any) {
  if (!isIssueActionable(event)) {
    return;
  }

  const issue = readIssueDetails(event);

  if (issue.state === "closed" || event.action === "closed") {
    historyCache.delete(issue.repository.fullName + issue.issue.number);
    return;
  }

  const repository = await prepareRepository(
    issue.repository.fullName,
    issue.repository.cloneUrl
  );

  if (repository === false) {
    return;
  }

  //  || issue.comment.body === 'retry'
  if (!issue.comment) {
    /*
    const task = `Context:
    Next task comes from ${issue.repository.url}.
    The repository is already cloned at ${process.cwd()}/${issue.repository.fullName}
    If a task requires reading the content of files, generate only commands to read them and nothing else.
    If task is completed, post a message on issue number #${issue.issue.number} at ${issue.issue.url}.
    If you are done, commit all changes and push.

    Description:
    # ${issue.issue.title}
    ${issue.issue.text}
    `;*/

    const tasks = await enumerateTasks(issue);
    logger.debug("Gen tasks for", issue.issue.title, tasks);
    const uid = randomUUID();

    while (tasks.length) {
      const next = tasks.shift();
      let [error, results] = await executeTask(next, issue, uid);

      logger.debug("Task: ${next}");
      logger.debug(error, results);

      if (error) {
        break;
      }
    }
  }

  if (issue.comment.body === "push") {
    return await pushAllChanges(issue.repository.fullName);
  }
}

async function tryTask(task: string, uid = randomUUID()) {
  try {
    return [null, await runTask(uid, task)];
  } catch (error) {
    sendEvent(uid, "error", String(error));
    logger.log("ERROR: " + String(error));
    return [error];
  } finally {
    streams.get(uid)?.end();
    streams.delete(uid);
  }
}

async function enumerateTasks(issue) {
  const session = createSession(
    `Context:
    Next job was create from Github Issue number #${issue.issue.number} at ${
      issue.repository.fullName
    }.
    The repository is already cloned locally at ${process.cwd()}/${
      issue.repository.fullName
    }.

    Job:
    ${issue.issue.title}
    ${issue.issue.text}

    Next:
    Create a list of tasks required to complete the job above.
    Use only text format and make every task in the list as detailed as possible.`
  );

  const completion = await getResponse(session.messages);
  const tasks = completion.trim().split("\n").filter(Boolean);

  return tasks;
}

async function executeTask(task: string, issue: Issue, uid) {
  const prompt = `
  Context:
  Next task comes from Github repository ${issue.repository.fullName}.
  The repository is already cloned at ${process.cwd()}/${
    issue.repository.fullName
  }.

  Job:
  Generate shell commands in a code block to complete the following task: "${task}".
  Never use the commands "sudo" or "su" to fix permissions errors.
  The system will give you the task results after executing the commands.
  `;

  return tryTask(prompt, uid);
}

async function runTask(uid: string, task: string) {
  let maxCycles = 5;
  const session = createSession(task);

  while (maxCycles) {
    const completion = await getResponse(session.messages);
    session.messages.push({
      role: "assistant",
      content: completion,
    });

    const commands = findCodeBlocks(completion);
    sendEvent(uid, "next", completion);

    logger.debug("NEXT: " + completion);
    logger.debug("COMMANDS:\n" + commands.join("\n"));

    if (!commands.length) {
      logger.log("HALT");
      sendEvent(uid, "halt", null);
      break;
    }

    const run = await runCommands(commands);

    if (run.ok) {
      const runOutput = run.outputs
        .map((o) => ["# " + o.cmd, o.output.stdout || "no output"].join("\n"))
        .join("\n\n");
      sendEvent(uid, "results", runOutput);
      maxCycles = 5;
      session.messages.push({
        role: "user",
        content: `Results:\n${runOutput}\n\nAnything else?`,
      });
    }

    if (!run.ok) {
      const lastCmd = run.outputs[run.outputs.length - 1];
      const error = String(lastCmd.output.error || lastCmd.output.stderr);
      sendEvent(uid, "error", error);
      maxCycles--;

      session.messages.push({
        role: "user",
        content: `Command \`${lastCmd.cmd}\` has failed with this error:\n${error}\nFix the command and write in the next instruction.`,
      });
    }
  }

  const sessionJson = JSON.stringify(session.messages.slice(3));
  logger.log("END: " + sessionJson);
  sendEvent(uid, "history", session.messages.slice(3));

  return sessionJson;
}

if (process.env.PORT) {
  createServer(onRequest).listen(process.env.PORT, () => {
    process.chdir(process.env.APP_WORKDIR);
    console.log(
      "Started at %s and %d",
      process.env.APP_WORKDIR,
      process.env.PORT
    );
  });
}
