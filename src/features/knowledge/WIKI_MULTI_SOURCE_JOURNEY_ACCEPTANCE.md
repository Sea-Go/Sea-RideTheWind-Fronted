# Wiki 两份来源人工维护与发布的本机产品验收

状态：test-only Web 独立叶子，真实RTW Admin/Worker
HTTP＋PG17＋Next管理BFF及公开固定修订本机验收通过；三路IndexManifest在此脚本是**结构fixture**，不是实际Dense/Sparse/Multi-vector编码与检索，也不构成真人Wiki质量达标。基Web内容开发`ee1071f42a4ce1530c2490bf54480e01f0e169f4`，本叶子只改`scripts/knowledge-acceptance.cjs`的隔离验收剧本，产品feature/BFF没有改动。

剧本先保存书A与书B原SourceRevision及SHA，人工Wiki
v3明确引用两份资料并在正文逐字写出`海拔影响温度。`和`迎风坡受到地形抬升降水的影响。`。管理员为这一**固定WikiRevisionID**冻结获准两Source范围的FactSet
required2，以来源原段落逐字quoteSHA/byte
span获得两独立FactID；再逐Fact单独提交RTW
`judged.v1`管理员主张。FactSet与判定提交后独立回读Wiki编辑head和人工Release：head仍是Wiki
v3，Release仍停在之前的人工r2，没有自动发表。随后RTW接受该候选Release的三路**结构READY
fixture**，只有显式管理员Activation才指向r3；公开按固定`release_id+wiki_revision_id/source_revision_id`重读Wiki正文及两原资料，与RTW原RevisionID/SHA对应。旧r1/r2和随后的人工回滚仍保留独立指针和历史正文。

第一次真PG轮代码`528c05e`在新增`covered/grade=3`判定处RED：RTW确定性合同要求目标Wiki中真实claim文字/SHA，测试只签Source
quote；父logSHA=`7b9be79f42cf4fd94c88179b2bbf902e62994c6026032f95e8c8667e5683ea53`、脱敏reportSHA=`43d13b7415ff06d16fccac0d5b1217dd5a3d1f658cc61b67448a8beb370108a8`，PG
stop/status3。修`7b5a149`给两个目标事实分别签`wiki_claim_text/wiki_claim_sha256`，第二真轮在公开正文对照处RED：`POST CreateWiki`只回修订元数据，不带原Wiki
`content`，测试误读`wiki3.content=undefined`；父logSHA=`b74d15b8658efdc8ead4d4424c6862142f1834902717459bb136ffa402af5ff4`、脱敏reportSHA=`3ef69ef048bbee38c9055af954dbda98bbe775cb0b3f72bbb010e106f83bce78`，该轮PG
stop/status3。修`3a5b649`按明确WikiRevisionID独立GET原正文并核`content_hash`，旧两份红日志都保留，未为通过而改RTW领域规则或刷新固定资料。

最终Web测试代码`3a5b649c34fe24c0269059fcb0979829c981a3ee`×RTW知识开发`5daca1b3d6959ccd8e1f39be7eeca70fe02e1974`×Next
BUILD_ID=`TLk08vpxEqH3AV_hDUsNH`用另一套全新隔离PG17重跑，顶层exit0、完整**29项**HTTP管理/公开断言PASS（其中双来源FactSet/两判定不自动发布和r3人工发布后固定Wiki/两Source回读两项新增）。报告`result.json`
SHA=`5724987f8283105c079358430f01171b9aaaa8739d90c3b6c72397982aa77c36`、父logSHA=`34dbe37bb598f46bbb124fcfc64ca141c1a99f8c70c164f538cf00582ffa959b`、PG
setupSHA=`b1ae7466e31cd3ac54744baa6755c4ca3928292e77ccfa3f0e033877e6923e6f`且`pg_ctl status=3`，RTW
API与Next两个测试listener后验已关闭；证据`sea-web-knowledge-acceptance-xPwoTC`。报告记录新CatalogRevisionID、两FactID与两独立质量EventID，不依赖活动Release反推被判版本。脚本`node --check`及Prettier检查通过；Next在该独立树自己的锁文件依赖下63页构建PASS、BUILD_ID如上、buildSHA=`1259e293c8f1246f64eda5e88a8dee4a2ec6875063e73738c7997f9c41750364`。最初尝试把另工作树的`node_modules`软链借给本树，Turbopack在构建前明确拒越根软链；保留红build.log并用`pnpm install --offline --frozen-lockfile --ignore-scripts`在本树自有依赖重建，未修改锁文件或产品代码。

本轮签**两份合成外部资料→人工Wiki
v3→两事实目录/各自管理员判定→结构READY→显式人工Release→公开固定原文**的本机产品/版本状态L3；未验真实三路索引READY、LLM编制质量、真人资料事实全集或D07。合成管理员的`grade=3`只是当轮测试主张，不是独立真人标签；RTW
Admin `actor_id`也不是UserCenter
UID。网页最终开发HEAD的这一新剧本、IAB实际操作、WhaleHall本人会话、检索真实引用与生产部署还须分别复验。
