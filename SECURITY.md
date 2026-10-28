# Security policy

## Supported versions

The latest released version gets fixes. While the version is below 1.0, that means the latest minor.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub: **Security → Report a vulnerability** on this repository. If that is not available to you,
write to me@miguelcolmenares.com with the version, what you found and how to reproduce it. You will get an answer within a week.

## What counts

- A way to make `sitekit check` pass over content or a built site that holds a credential or an internal detail.
- A way to make `init`, `add` or `check` write or read outside the repository or the site folder it was given.
- A generated site that makes a request to a host it should not, or that ships a script it did not declare.
- A dependency vulnerability that reaches a generated site and not only this repository's tooling.

`sitekit check` is a safety net, not a guarantee: it looks for known shapes of secrets. It does not replace reviewing what you publish.
