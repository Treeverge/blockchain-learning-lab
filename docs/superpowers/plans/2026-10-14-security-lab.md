# 重入安全实验实施计划

目标：以守恒资金和分层回滚，让学习者解释漏洞、防护与失败传播。

架构：security.js纯模型返回最终状态和临时轨迹；security-lab.js负责四阶段与轨迹浏览；Python共享整数样例；Solidity真实VM单独验证。无框架静态HTML/CSS/JS。

- [x] 建立 tests/security.test.cjs，先运行 node --test tests/security.test.cjs 确认缺少模型，再实现 assets/js/security.js。覆盖正常提款、耗尽、两种防护、内层捕获、整体回滚、拒收、诚实用户偿付失败与输入边界。
- [x] 建立 tests/test*security.py；修正 day6-security/01-reentrancy-attack.py 的实际现金、递归和回滚；python -X utf8 -m unittest discover -s tests -p 'test*\*.py' 必须通过。
- [x] 完善 day6-security/02-reentrancy-sol.sol，增加有界攻击合约和隔离锁对照；tests/security-solidity-check.cjs编译并执行三个版本及catch/bubble/reject场景，真实费用单独核对。
- [x] 建立 03-演示文稿/security-lab.html、assets/js/security-lab.js，复用lab.css并加入必要轨迹样式。每次实验重置初态；逐步浏览不改变最终账本。
- [x] 扩展tests/browser-check.cjs检查四阶段、最终资金、轨迹、失败、非法输入、文件打开、减少动态效果、390px无溢出并检查截图。
- [x] 更新首页、账户页下一步、Day6README、项目分享说明、验证文档和CI；请求独立只读代码复核，修正发现的问题。
      发布验收：完整模型/Python/VM/浏览器验证通过后，提交并推送已授权的主分支；必须核对CI、Pages对应SHA和线上交互。
