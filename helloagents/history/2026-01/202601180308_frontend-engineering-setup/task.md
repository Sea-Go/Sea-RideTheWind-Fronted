# 浠诲姟娓呭崟: 鍓嶇宸ョ▼鍖栧熀纭€鏋跺瓙

鐩綍: `helloagents/plan/202601180308_frontend-engineering-setup/`

---

## 1. 椤圭洰鑴氭墜鏋?- [√] 1.1 鍦ㄦ牴鐩綍浣跨敤 `create-next-app` 鍒濆鍖?Next.js(App Router) + TypeScript + `src/`锛岀敓鎴愬熀纭€缁撴瀯涓?`package.json`锛岄獙璇?why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?- [√] 1.2 鍒濆鍖?shadcn/ui 榛樿閰嶇疆锛岀敓鎴?`components.json` 涓庢牱寮忛厤缃紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?

## 2. 浠ｇ爜璐ㄩ噺涓庢牸寮?- [√] 2.1 閰嶇疆 ESLint 瑙勫垯涓庤剼鏈紙`eslint.config.mjs`, `package.json`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?- [√] 2.2 閰嶇疆 Prettier 涓?`prettier-plugin-tailwindcss`锛坄.prettierrc._`, `package.json`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?- [√] 2.3 閰嶇疆 Stylelint 瑙勫垯涓庤剼鏈紙`stylelint.config._`, `package.json`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?

## 3. 鎻愪氦娴佺▼涓庝氦浜掑紡鎻愪氦

- [√]
  3.1 閰嶇疆 commitlint 瑙勫垯锛坄commitlint.config._`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?- [√] 3.2 閰嶇疆 Commitizen + cz-git锛坄package.json`/`cz-git.config._`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?- [√] 3.3 閰嶇疆 Husky 涓?lint-staged锛坄.husky/*`,
  `.lintstagedrc.*`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-澶氫汉鍗忎綔涓庤川閲忛棬绂?

## 4. 鐜涓庡寘绠＄悊绾︽潫

- [√]
  4.1 鍐欏叆 Node/pnpm 鐗堟湰绾︽潫锛坄.nvmrc`, `.node-version`, `package.json` engines/packageManager锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-涓€鑷磋繍琛岀幆澧?- [√] 4.2 鍚敤 corepack 骞惰ˉ鍏?pnpm 浣跨敤绾﹀畾锛坄package.json`/`.npmrc`锛夛紝楠岃瘉 why.md#闇€姹?宸ョ▼鍖栧熀纭€-鍦烘櫙-涓€鑷磋繍琛岀幆澧?

## 5. 娴嬭瘯浣撶郴

- [√] 5.1 闆嗘垚 Vitest + React Testing
  Library锛坄vitest.config.ts`, `src/\*_/**tests**/_`锛夛紝楠岃瘉 why.md#闇€姹?娴嬭瘯涓庢寔缁泦鎴?鍦烘櫙-PR鍚堝叆鍓嶉獙璇?- [√] 5.2 闆嗘垚 Playwright锛坄playwright.config.ts`,
  `tests/e2e/*`锛夛紝楠岃瘉 why.md#闇€姹?娴嬭瘯涓庢寔缁泦鎴?鍦烘櫙-PR鍚堝叆鍓嶉獙璇?

## 6. 鎸佺画闆嗘垚

- [√] 6.1 娣诲姞 GitHub
  Actions 宸ヤ綔娴侊紙`.github/workflows/ci.yml`锛夛紝楠岃瘉 why.md#闇€姹?娴嬭瘯涓庢寔缁泦鎴?鍦烘櫙-PR鍚堝叆鍓嶉獙璇?

## 7. 瀹夊叏妫€鏌?- [√] 7.1 鎵ц瀹夊叏妫€鏌ワ紙鎸?G9: 杈撳叆楠岃瘉銆佹晱鎰熶俊鎭鐞嗐€佹潈闄愭帶鍒躲€丒HRB 椋庨櫓瑙勯伩锛?

## 8. 鏂囨。鏇存柊

- [√]
  8.1 鏇存柊鐭ヨ瘑搴擄細`helloagents/wiki/overview.md`銆乣helloagents/wiki/arch.md`銆乣helloagents/wiki/modules/tooling.md`銆乣helloagents/wiki/modules/quality.md`
- [√] 8.2 鏇存柊 `helloagents/CHANGELOG.md`

## 9. 娴嬭瘯

- [√] 9.1 杩愯 `pnpm lint`銆乣pnpm typecheck`銆乣pnpm test`銆乣pnpm
  e2e`銆乣pnpm build`
