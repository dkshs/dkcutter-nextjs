{% if dkcutter.useEnvValidator -%}
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.mjs");

{% endif -%}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
