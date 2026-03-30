import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        files: ["**/*.ts", "**/*.tsx"],
        ignores: [
            ".next/**",
            "node_modules/**",
            "out/**",
            "build/**",
            "coverage/**",
            "next-env.d.ts",
        ],
    },
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": "error",
            "@typescript-eslint/no-empty-object-type": "error",
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-inferrable-types": "off",

        },
    },
];

export default eslintConfig;