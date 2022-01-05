import * as core from "@actions/core";
import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>

async function run() {
  try {
    const payload = github.context.payload;
    const comment = payload.comment;
    const sender = payload.sender?.login;
    const token = core.getInput("github_token");
    const name = core.getInput("name");
    const approveCommand = core.getInput("approve_comment");
    const type = core.getInput("type");

    const shouldRun = comment?.body.includes(approveCommand);
    if (!shouldRun) return;

    const octokit = github.getOctokit(token);

    const repository = payload.repository;

    if (!repository) {
      core.setFailed("Could not find repository.");
      return;
    }

    const repo = repository.name;
    const owner = repository.owner.login;
    const pull_number = payload.issue?.number;

    if (!pull_number) {
      core.setFailed("Could not find issue/pull request.");
      return;
    }

    const pull = await octokit.rest.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: pull_number,
    });
    const ref = pull.data.head.ref;
    const sha = pull.data.head.sha;

    switch(type) {
      case "status":
        runStatus(octokit, name, owner, repo, ref, sha, sender)
        break;

      case "check":
        runCheck(octokit, name, owner, repo, ref)
        break;

      default:
        throw new Error("Unknown type");
        break;
    }

  } catch (error) {
    let message = "Something went wrong";

    if (error instanceof Error) {
      message = error.message;
    }

    core.setFailed(message);
  }
}

async function runStatus(octokit: Octokit, contextName: string, owner: string, repo: string, ref: string, sha: string, sender: string) {
  const statuses = await octokit.rest.repos.listCommitStatusesForRef({
    owner,
    repo,
    ref,
  });

  const existingStatus = statuses.data.find(
    (status) => status.context === contextName
  );

  if (!existingStatus) {
    const statusContexts = statuses.data
      .map((status) => status.context)
      .join(", ");
    core.setFailed(
      `Could not find a status with the context: ${contextName}. Possible contexts: [${statusContexts}]`
    );

    return;
  }

  await octokit.rest.repos.createCommitStatus({
    owner: owner,
    repo: repo,
    sha: sha,
    state: "success",
    description: `${existingStatus.description} — approved by ${sender}`,
    context: contextName,
    target_url: existingStatus.target_url,
  });

  core.notice(`${contextName} was marked as successful!`);
}

async function runCheck(octokit: Octokit, checkName: string, owner: string, repo: string, ref: string) {
  const checks = await octokit.rest.checks.listForRef({
    owner: owner,
    repo: repo,
    ref: ref,
  });

  const check_run_id = checks.data.check_runs.find(
    (check) => check.name === checkName
  )?.id;

  if (!check_run_id) {
    const checkNames = checks.data.check_runs
      .map((check) => check.name)
      .join(", ");
    core.setFailed(
      `Could not find a check with the name: ${checkName}. Possible names: [${checkNames}]`
    );

    return;
  }

  await octokit.rest.checks.update({
    owner,
    repo,
    check_run_id,
    conclusion: "success",
  });

  core.notice(`${checkName} was marked as successful!`);
}

run();
