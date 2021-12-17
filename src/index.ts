import * as core from "@actions/core";
import * as github from "@actions/github";

async function run() {
  try {
    const payload = github.context.payload;
    const comment = payload.comment;
    const token = core.getInput("github_token");
    const checkName = core.getInput("check_name");
    const approveCommand = core.getInput("approve_comment");

    const shouldRun = comment?.body === approveCommand;
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
      owner,
      repo,
      pull_number,
    });
    const ref = pull.data.head.ref;

    const checks = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref,
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
  } catch (error) {
    let message = "Something went wrong";
    if (error instanceof Error) {
      message = error.message;
    }
    core.setFailed(message);
  }
}

run();
