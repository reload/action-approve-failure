# action-approve-failure

GitHub action that let's you turn failure into success. For a short while.

## Example

Presume you have a couple of jobs that run on pull requests.
(These are merely examples but take a look in `.github/workflows` for closer inspection)

```yaml
name: Checks

on: pull_request

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - uses: LouisBrunner/checks-action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          name: BackstopJS visual test
          conclusion: failure

      - uses: LouisBrunner/checks-action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          name: ESLint
          conclusion: failure
```

These jobs might from time to time need to be forced into success since a failure
might just be a new state.

In comes `action-approve-failure`:

```yaml
name: Approve failure

on:
  issue_comment:
    types: [created]

jobs:
  approve-failure:
    # This condition is important since you want to prevent all of the steps
    # from running as early as possible if the comment isn't in a PR.
    if: ${{ github.event.issue.pull_request }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - uses: reload/action-approve-failure@main
        name: Approve BackstopJS
        with:
          github_token: ${{ github.token }}
          type: status
          name: BackstopJS visual test
          approve_comment: backstop-check approve

      - uses: reload/action-approve-failure@main
        name: Approve ESLint
        with:
          github_token: ${{ github.token }}
          type: check
          name: ESLint
          approve_comment: eslint-check approve
```

Now, by simply commenting `backstop-check approve` you can turn that `failure`
into a `success`. The victory is short lived though. Whenever the PR get's
updated and the jobs re-run your override will be lost and you are forced to
yet again determine if this failure is change of state or an actual failure.
