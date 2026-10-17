"""Run the no-server Day 2 fork and UTXO reorganization walkthrough."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verified_network import create_network, mine_block  # noqa: E402


def main():
    net = create_network()
    x, y = net.candidates["X"], net.candidates["Y"]
    net.receive("A", x)
    net.receive("B", x)
    net.receive("C", y)
    print("Day 2 · 三节点签名交易与账本重组（无需服务器）")
    print("X / Y 均由 Alice 签名、花同一笔 70；待确认时三个账本都未扣款。")
    net.mine("A")
    net.mine("C")
    tie = net.adopt("A", net.nodes["C"].chain)
    print(f"A / C 各有一块、各 16 单位预期工作；传播结果：{tie['reason']}，A 仍保留 X。")
    net.mine("C")
    report = net.adopt("A", net.nodes["C"].chain)
    node = net.nodes["A"]
    print(f"C 增加空块后：{report['reason']}；A 重放 Y、撤下 X。")
    print(f"Alice={node.ledger.balance(net.people['Alice'])}，"
          f"Bob={node.ledger.balance(net.people['Bob'])}，"
          f"Eve={node.ledger.balance(net.people['Eve'])}，费用={node.ledger.fees}。")
    print("对账：未花费输出 + 累计费用 =",
          sum(utxo.amount for utxo in node.ledger.utxos.values()) + node.ledger.fees)
    print("X 的签名仍有效，但输入已由 Y 花费；不会回到 A 的待确认池。")

    invalid = [net.genesis]
    invalid.append(mine_block(invalid, net.forge_wrong_owner()))
    invalid.append(mine_block(invalid))
    invalid.append(mine_block(invalid))
    rejected = net.adopt("A", invalid)
    if rejected["reason"] == "invalid":
        print("无效长链被拒绝：证明工作通过，但 Eve 无权花 Alice 的输入。")
    print("边界：固定难度与本地手动传播，不是 Bitcoin 网络或完整共识。")


if __name__ == "__main__":
    main()
