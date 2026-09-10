/**
 * Peak-hour banner plugin, node half.
 *
 * Pure UI plugin: the empty `apply` exists only so the row mounts in the host
 * Loader tree. The browser half ships through `exports["./client"]`, which
 * `@deepseek-ai/dsh-client-modules` discovers from the `dsh.client`
 * declaration in `package.json` and serves under `/plugins`.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
function apply() {}

export { apply };
