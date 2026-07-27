import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "e2e/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default eslintConfig;
