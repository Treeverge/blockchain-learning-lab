# 学习路径实施计划

目标：八站情景题、解释标准和源码挑战，配合诚实的本地自检记录。

- [x] tests/curriculum.test.cjs先建立内容、评分、确认门槛、变更撤销、读入校验、导出与来源链接测试；node --test tests/curriculum.test.cjs先失败，再实现assets/js/curriculum.js。
- [x] 实现learning-path.html与assets/js/learning-path.js，左导航右学习输出，URL lesson参数可回到对应站。所有控件初始化前禁用，localStorage不可用/损坏时使用内存并提示。
- [x] 首页增加推荐学习入口，八实验页底部增加对应自检链接；更新README、学习说明与CI。
- [x] 扩展tests/browser-check.cjs，检查答题、解释与确认、修改撤销、刷新、导出、清除取消/确认、损坏与不可用存储、URL路由、八站390px、直接文件运行和无脚本错误。
- [x] 运行完整模型及Python、浏览器检查；检查桌面/手机截图；按requesting-code-review技能请求只读独立复核，修正问题并验证。

发布验收：完整验证后提交并推送已授权的主分支，核对对应SHA的GitHub检查和Pages发布，再检查线上自检交互。
