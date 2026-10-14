(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LearningLab = factory();
})(globalThis, function () {
  "use strict";
  const q = (id, prompt, choices, correct, explanation) => ({
    id,
    prompt,
    choices,
    correct,
    explanation,
  });
  const lessons = [
    {
      id: "hash",
      title: "哈希与有效历史",
      chapter: "Day 1",
      minutes: 20,
      href: "03-演示文稿/chain-lab.html",
      source: "assets/js/chain.js",
      test: "tests/chain.test.cjs",
      questions: [
        q(
          "hash-repair",
          "修改旧文本后，把后续哈希全部重算。这个结果能证明什么？",
          [
            "修改后的业务文本一定真实",
            "本地链接可以重新自洽，真实性仍需其他证据",
            "其他节点一定会接受修改",
          ],
          1,
          "重算解决内容与链接一致性，不能证明业务事实真实或全网已经接受。启用PoW后，重算也不能代替有效证明。",
        ),
        q(
          "hash-invalid",
          "候选历史更长，但其中一个非创世块没有满足本页难度的PoW，节点如何处理？",
          ["因为更长而接受", "先看支持节点是否过半", "拒绝无效候选"],
          2,
          "候选先通过完整校验，才比较有效工作。长度和支持人数都不能覆盖无效证明。",
        ),
      ],
      prompt:
        "解释修改、重算、重新挖矿、传播这四个动作分别改变了什么；说明它们没有证明什么。",
      rubric: [
        "区分文本哈希、前后链接和PoW证明，不能把重算称为重新挖矿。",
        "说明接收节点先验证、再比较有效工作，等工作保留当前链。",
        "指出链上文本是否真实仍取决于录入来源，哈希不验证现实事实。",
      ],
      challenge: {
        task: "在新增测试中构造一条长度更长但含一个无效PoW的候选，验证选链仍拒绝，并确认原节点历史没有改变。不要删除原有测试。",
        expected: "拒绝原因来自候选校验；原状态保持一致。",
      },
    },
    {
      id: "utxo",
      title: "签名与可花费输入",
      chapter: "Day 3",
      minutes: 20,
      href: "03-演示文稿/utxo-lab.html",
      source: "assets/js/utxo.js",
      test: "tests/utxo.test.cjs",
      questions: [
        q(
          "utxo-tamper",
          "Alice已签名。把收款人改为Eve，再重算主体ID但保留原签名，能确认吗？",
          [
            "不能，旧签名没有授权修改后的主体",
            "能，主体ID已经匹配",
            "能，Eve是存在的角色",
          ],
          0,
          "主体ID自洽不等于签名有效。签名绑定输入、输出和费用，改收款人后旧签名失效。",
        ),
        q(
          "utxo-conflict",
          "两笔交易都由Alice正确签名，却使用同一个输入。第一笔确认后，第二笔是什么状态？",
          [
            "签名自动变成伪造",
            "签名仍可有效，输入已花费而无法再次确认",
            "只要手续费更高就可以同时确认",
          ],
          1,
          "授权检查与可花费性不同。签名可以仍正确，但当前账本不再含这个可用输入。",
        ),
      ],
      prompt:
        "用默认70的输入解释45给Bob、24找零与1费用。再说明“签名有效”和“现在能花费”为什么不同。",
      rubric: [
        "写出70 = 45 + 24 + 1，并指出找零仍属于Alice。",
        "说明确认消耗整个输入，产生新输出而不是直接修改原输入金额。",
        "指出有效签名仍可能因为输入已花费或所有者不符而被拒绝。",
      ],
      challenge: {
        task: "新增Alice使用70输入向Bob转30、费用1的签名交易测试，验证找零39、Alice合计69、Bob合计80、费用1，并测试重复确认拒绝。",
        expected: "默认150总资产守恒；拒绝不再扣款。",
      },
    },
    {
      id: "network",
      title: "分叉与账本重组",
      chapter: "Day 2",
      minutes: 25,
      href: "03-演示文稿/network-lab.html",
      source: "assets/js/network.js",
      test: "tests/network.test.cjs",
      questions: [
        q(
          "network-tie",
          "A与B持有X分支，C持有Y分支，两分支有效工作相同。传播后本模型怎样选？",
          [
            "两票对一票，X自动胜出",
            "C的分支较新，全部换成Y",
            "各节点保留当前等工作历史",
          ],
          2,
          "本页不是多数投票；等有效工作保留当前历史，分叉可以暂时存在。",
        ),
        q(
          "network-reorg",
          "更多有效工作使X被Y替换。旧X的输出与费用如何处理？",
          [
            "回到共同起点重放新历史，旧X输出与费用撤下",
            "保留X费用，并额外收Y费用",
            "只修改页面标签，不改变账本",
          ],
          0,
          "重组替换整段交易历史。本模型从可信初态重放Y，不把X和Y的输出或费用累加。",
        ),
      ],
      prompt:
        "分别解释待确认池冲突、等工作分叉和更多工作重组。说明被撤下的X为何不能立即花同一个输入。",
      rubric: [
        "待确认池只决定本节点接收顺序，不等于已确认或全网投票。",
        "等工作保留当前分支；更多有效工作仍需交易授权与PoW校验。",
        "重放Y后同一输入已消耗，X的签名仍有效也不能确认；旧费用不会重复留存。",
      ],
      challenge: {
        task: "新增测试：让一个只含空块的更高工作分支替换X，验证X恢复待确认；重新挖入X后，费用重新变1而不是2。",
        expected: "孤立交易只有在新账本仍有效且无冲突时才恢复。",
      },
    },
    {
      id: "account",
      title: "账户与执行边界",
      chapter: "Day 4",
      minutes: 20,
      href: "03-演示文稿/account-lab.html",
      source: "assets/js/account.js",
      test: "tests/account.test.cjs",
      questions: [
        q(
          "account-revert",
          "一笔已纳入的transferThenFail写入LAB和counter后主动失败。本模型最终留下什么？",
          [
            "LAB、counter和日志都保留",
            "业务写入与日志回滚，发送者nonce和已消耗费用保留",
            "业务与费用、nonce全部恢复",
          ],
          1,
          "已纳入执行的合约失败不同于纳入前拒绝。业务状态回滚，nonce与执行费用保留。",
        ),
        q(
          "account-spender",
          "Alice授权Eve，Eve发起transferFrom将Alice的LAB转给Bob。谁支付原生G费用？",
          ["Eve", "Alice", "Bob"],
          0,
          "交易发送者Eve支付G；Alice的LAB与授权额度属于Token合约业务状态。",
        ),
      ],
      prompt:
        "对照“旧nonce纳入前拒绝”和“已纳入后合约失败”，分别列出G、nonce、LAB、counter与日志是否改变。",
      rubric: [
        "旧nonce拒绝没有再次执行，不扣费用、不增加nonce。",
        "已纳入的失败消耗费用并增加nonce，业务写入与事件恢复。",
        "G账户和Token存储是不同账本；网页定额不是EVM实测Gas。",
      ],
      challenge: {
        task: "新增撤销授权测试：approve 20后approve 0，Eve再代转1。核对拒绝后的授权仍为0、LAB不变，但Eve因已纳入的失败付费且nonce增加。",
        expected: "分开授权拒绝、业务回滚与发送者执行结算。",
      },
    },
    {
      id: "exchange",
      title: "交换与过期报价",
      chapter: "Day 5 · 1/3",
      minutes: 15,
      href: "03-演示文稿/defi-exchange.html",
      source: "assets/js/amm.js",
      test: "tests/amm.test.cjs",
      questions: [
        q(
          "exchange-nofee",
          "1000 A / 1000 B储备，无手续费，输入100 A。本模型输出是多少？",
          ["100 B", "90 B", "90.909090 B（六位小数）"],
          2,
          "无费输出=floor(100×1000/(1000+100))，按六位精度向下取整。储备比例不是整笔成交均价。",
        ),
        q(
          "exchange-stale",
          "报价后别人先成交，新输出低于你设定的最小接收量。执行怎样处理？",
          [
            "仍按旧输出付款",
            "拒绝交换，保持本次执行前账本",
            "只退手续费但转出输入",
          ],
          1,
          "最小接收量在当前储备上检查。不满足时本次交换不提交；之前他人的交易并不会被撤销。",
        ),
      ],
      prompt:
        "解释默认100 A为何换到90.661089 B，并追踪100 A、手续费和输出分别进入或离开哪里。",
      rubric: [
        "区分初始比例、边际价格和整笔平均价格；交易规模会改变储备。",
        "完整100 A进入池子；手续费留在池内，不能另造一笔资产。",
        "过期报价拒绝保留当前账本，不能把此前交易也回滚。",
      ],
      challenge: {
        task: "新增反向无费报价测试：从1000/1000储备输入100 B，检查输出90.909090 A，逐资产对账并核对最小接收量失败时状态不变。",
        expected: "反向规则对称，A和B分别守恒。",
      },
    },
    {
      id: "lp",
      title: "流动性与持有比较",
      chapter: "Day 5 · 2/3",
      minutes: 20,
      href: "03-演示文稿/defi-liquidity.html",
      source: "assets/js/lp.js",
      test: "tests/lp.test.cjs",
      questions: [
        q(
          "lp-price",
          "只把外部价格从1改成4，还没执行套利，池子储备会怎样？",
          [
            "保持不变；价格标签不是一笔交易",
            "自动变成新的平衡比例",
            "A和B都翻四倍",
          ],
          0,
          "外部价格是参考信息。真实模型资金由套利钱包交易后才改变储备。",
        ),
        q(
          "lp-hold",
          "无费用样例投入100 A+100 B，价格到4并完成套利。相对直接持有的价值差距约多少？",
          ["正20%", "负20%", "负100%"],
          1,
          "教学样例LP约值400 B，直接持有值500 B；(400-500)/500=-20%。这比较的是机会差距，不能把费用再额外重复相加。",
        ),
      ],
      prompt:
        "把外部价格改变、套利交易、LP份额和退出分开解释。为什么赚到手续费也不能自动保证跑赢直接持有？",
      rubric: [
        "外部价格本身不转移资金，套利账户支付真实模拟资产。",
        "LP份额代表池子储备的比例权利，手续费已经在储备与退出价值中。",
        "价值比较须使用同一外部价格与初始投入；收益不能只看余额数量。",
      ],
      challenge: {
        task: "在源码副本中把0.25加入setPrice允许的价格预设，再新增无费下跌对照测试：相同100 A+100 B投入，套利后持有价值125 B、LP约100 B，差距约-20%。检查套利钱包与池子逐资产守恒。",
        expected:
          "价格上涨与下跌都可能出现相对持有差距，允许六位整数舍入误差。",
      },
    },
    {
      id: "lending",
      title: "偿付、清算与坏账",
      chapter: "Day 5 · 3/3",
      minutes: 20,
      href: "03-演示文稿/defi-lending.html",
      source: "assets/js/lending.js",
      test: "tests/lending.test.cjs",
      questions: [
        q(
          "lending-threshold",
          "抵押3 C、债务180 B，价格75 B/C。本页规则能清算吗？",
          [
            "能，因为价格下降了",
            "必须先看借款人是否同意",
            "不能，健康因子恰好1，规则要求小于1",
          ],
          2,
          "健康因子=0.8×3×75/180=1。阈值与实际执行是两个步骤，价格下降不自动等于可清算。",
        ),
        q(
          "lending-bad-debt",
          "相同抵押和债务，价格降至60。按本页5%奖励、全额关闭规则，结果是什么？",
          [
            "抵押不足以覆盖奖励后的偿付，确认约8.571429 B坏账",
            "清算者凭空生成180 B偿清",
            "健康因子恢复，所以没有损失",
          ],
          0,
          "清算者最多用171.428571 B换取3 C，债务剩余8.571429 B确认为坏账；这是本教学规则，不是所有协议的清算机制。",
        ),
      ],
      prompt:
        "说明抵押物、现金、债务和坏账如何分开对账；再说明为什么“可以清算”不保证出借者足额收回。",
      rubric: [
        "借入B来自出借者/池子的现金，债务不是额外现金。",
        "健康因子是资格指标，实际清算还须有清算者支付与抵押交付。",
        "极端价格下，抵押扣除奖励后的价值不足，差额成为坏账；本页省略利息和部分清算。",
      ],
      challenge: {
        task: "新增价格60后的补救测试：先还100 B，债务从180变80，健康因子到1.8，仍未关闭。确认池子现金增加100、借款人现金减少100、抵押仍为3。",
        expected: "还款改变债务与现金，不能凭空增加抵押或销毁现金。",
      },
    },
    {
      id: "security",
      title: "重入与失败传播",
      chapter: "Day 6",
      minutes: 20,
      href: "03-演示文稿/security-lab.html",
      source: "assets/js/security.js",
      test: "tests/security.test.cjs",
      questions: [
        q(
          "security-seven",
          "初始银行6 G，漏洞版本尝试接收7次，内层失败向外传播。本次最终怎样？",
          [
            "攻击合约保留前6次付款",
            "全部提款回滚，现金6、攻击合约收到0，先前1 G存款债权保留",
            "银行凭空再生成1 G完成付款",
          ],
          1,
          "第7次实际现金不足，未捕获的失败继续向外传播，前面6次临时付款一起撤销。存款发生在先前事务。",
        ),
        q(
          "security-liability",
          "漏洞版本最多接收6次成功，银行现金0、剩余债权5。总资金6说明什么？",
          [
            "没有任何人受损",
            "债权也算资金，所以总共有11",
            "资金守恒仍可发生盗取，银行已无力偿付其他存款人",
          ],
          2,
          "现金与接收余额总计仍6，但其他用户的5 G债权没有现金支持；守恒不等于分配安全。",
        ),
      ],
      prompt:
        "解释CEI和锁为什么都能阻止第二次付款，再比较捕获与传播内层失败时第一次付款的最终命运。",
      rubric: [
        "CEI在外部调用前清零债权，锁在回调重入时拒绝进入；机制不同。",
        "捕获内层失败并正常返回可保留首次付款，向外传播则整笔提款回滚。",
        "区分临时快照与最终状态；守恒不等于安全，锁也不等于完整安全审计。",
      ],
      challenge: {
        task: "新增7 G初态测试：Alice债权4、Bob2、攻击合约1，现金7。最多接收7次成功后现金0、缺口6；尝试8次且传播失败时恢复整个初态。",
        expected:
          "修改初态时同步实际现金与债权来源；两个场景所有临时资金均守恒7。",
      },
    },
  ];
  function lesson(id) {
    const l = lessons.find((x) => x.id === id);
    if (!l) throw new Error("未知学习站点");
    return l;
  }
  function emptyRecord() {
    return { answers: {}, note: "", reviewed: false };
  }
  function createState() {
    return {
      version: 1,
      records: Object.fromEntries(lessons.map((l) => [l.id, emptyRecord()])),
    };
  }
  function clone(s) {
    return {
      version: 1,
      records: Object.fromEntries(
        lessons.map((l) => [
          l.id,
          {
            answers: { ...s.records[l.id].answers },
            note: s.records[l.id].note,
            reviewed: s.records[l.id].reviewed,
          },
        ]),
      ),
    };
  }
  function score(s, id) {
    return lesson(id).questions.filter(
      (q) => s.records[id].answers[q.id] === q.correct,
    ).length;
  }
  function canConfirm(s, id) {
    return score(s, id) === 2 && s.records[id].note.trim().length > 0;
  }
  function answer(s, id, qid, value) {
    const q = lesson(id).questions.find((x) => x.id === qid);
    if (
      !q ||
      !Number.isInteger(value) ||
      value < 0 ||
      value >= q.choices.length
    )
      throw new Error("无效选择");
    const n = clone(s);
    if (n.records[id].answers[qid] !== value) n.records[id].reviewed = false;
    n.records[id].answers[qid] = value;
    return n;
  }
  function explain(s, id, note) {
    lesson(id);
    if (typeof note !== "string" || note.length > 6000)
      throw new Error("解释最多6000个字符");
    const n = clone(s);
    if (n.records[id].note !== note) n.records[id].reviewed = false;
    n.records[id].note = note;
    return n;
  }
  function confirm(s, id) {
    if (!canConfirm(s, id))
      throw new Error("请先答对两道情景题并填写解释，再对照标准确认自检。");
    const n = clone(s);
    n.records[id].reviewed = true;
    return n;
  }
  function clear(s, id) {
    lesson(id);
    const n = clone(s);
    n.records[id] = emptyRecord();
    return n;
  }
  function summary(s) {
    return {
      completed: lessons.filter(
        (l) => s.records[l.id].reviewed && canConfirm(s, l.id),
      ).length,
      next:
        lessons.find((l) => !(s.records[l.id].reviewed && canConfirm(s, l.id)))
          ?.id || null,
    };
  }
  function object(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function decode(raw) {
    const data = JSON.parse(raw);
    if (!object(data) || data.version !== 1 || !object(data.records))
      throw new Error("学习记录格式或版本无法读取");
    const s = createState();
    for (const l of lessons) {
      const r = data.records[l.id];
      if (r === undefined) continue;
      if (
        !object(r) ||
        !object(r.answers) ||
        typeof r.note !== "string" ||
        r.note.length > 6000 ||
        typeof r.reviewed !== "boolean"
      )
        throw new Error("学习记录字段无法读取");
      s.records[l.id].note = r.note;
      for (const q of l.questions) {
        const v = r.answers[q.id];
        if (v === undefined) continue;
        if (!Number.isInteger(v) || v < 0 || v >= q.choices.length)
          throw new Error("学习记录答案无法读取");
        s.records[l.id].answers[q.id] = v;
      }
      s.records[l.id].reviewed = r.reviewed && canConfirm(s, l.id);
    }
    return s;
  }
  function exportMarkdown(s) {
    const out = [
      "# 区块链学习记录",
      "",
      "选择题由模型核对；解释与完成标记由学习者自行核对，不是掌握认证。",
      "",
    ];
    for (const l of lessons) {
      const r = s.records[l.id];
      out.push(
        `## ${l.title}`,
        `选择题：${score(s, l.id)} / 2；${r.reviewed && canConfirm(s, l.id) ? "已确认自检" : "未确认自检"}`,
        "",
      );
      for (const q of l.questions) {
        const v = r.answers[q.id];
        out.push(
          `- ${q.prompt}`,
          `  选择：${v === undefined ? "未作答" : q.choices[v]}${v === undefined ? "" : v === q.correct ? "（正确）" : "（需复习）"}`,
        );
      }
      out.push(
        "",
        "我的解释：",
        "",
        ...(r.note || "尚未填写")
          .split("\n")
          .map(
            (line) =>
              "> " +
              line
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;"),
          ),
        "",
        "源码挑战：" + l.challenge.task,
        "验收：" + l.challenge.expected,
        "",
      );
    }
    return out.join("\n");
  }
  return {
    lessons,
    lesson,
    createState,
    score,
    canConfirm,
    answer,
    explain,
    confirm,
    clear,
    summary,
    decode,
    exportMarkdown,
  };
});
