"""Day 5: 零费理想情景下，LP 退出与原样持有的两资产对账。

本文件只模拟外部价格由 1 升到 4 B/A 后的一次 B→A 套利。
它不是市场路由器，也不模拟 Gas、真实交易所或 Solidity 的最小锁定份额。
"""

from decimal import Decimal
from math import isqrt


SCALE = 1_000_000


def create_state():
    return {
        "balances": {
            "pool": {"A": 1000 * SCALE, "B": 1000 * SCALE},
            "lp": {"A": 100 * SCALE, "B": 100 * SCALE},
            "arbitrage": {"A": 0, "B": 10000 * SCALE},
            "market": {"A": 100000 * SCALE, "B": 100000 * SCALE},
        },
        "price": SCALE,
        "shares_total": 1000 * SCALE,
        "lp_shares": 0,
        "deposited": None,
        "exited": False,
    }


def totals(state):
    """A 与 B 分别守恒，不能把估值或 LP 份额加进资产数量。"""
    return {asset: sum(wallet[asset] for wallet in state["balances"].values())
            for asset in ("A", "B")}


def deposit(state, amount):
    if state["deposited"] is not None:
        raise ValueError("本情景只允许新 LP 投入一次")
    pool, lp = state["balances"]["pool"], state["balances"]["lp"]
    if type(amount) is not int or amount <= 0 or any(lp[a] < amount for a in ("A", "B")):
        raise ValueError("投入金额无效或钱包余额不足")
    if pool["A"] != pool["B"]:
        raise ValueError("本情景只演示初始等比例池")
    shares = amount * state["shares_total"] // pool["A"]
    if shares <= 0:
        raise ValueError("份额舍入为零")

    for asset in ("A", "B"):
        lp[asset] -= amount
        pool[asset] += amount
    state["shares_total"] += shares
    state["lp_shares"] = shares
    state["deposited"] = {"A": amount, "B": amount}
    return shares


def set_price(state, price):
    if state["deposited"] is None or state["exited"]:
        raise ValueError("请先投入且不要在退出后改价")
    if type(price) is not int or price <= 0:
        raise ValueError("外部价格必须是正整数最小单位")
    state["price"] = price  # 参考价格本身不转移 A 或 B。


def arbitrage(state):
    """零费、向上改价的 B→A 套利；先验算资金与利润，再移动资产。"""
    if state["deposited"] is None or state["exited"]:
        raise ValueError("请先投入且不要在退出后套利")
    pool = state["balances"]["pool"]
    trader = state["balances"]["arbitrage"]
    market = state["balances"]["market"]
    target_b = isqrt(pool["A"] * pool["B"] * state["price"] // SCALE)
    paid_b = target_b - pool["B"]
    if paid_b <= 0:
        raise ValueError("当前价格没有本方向可获利的套利")
    received_a = paid_b * pool["A"] // (pool["B"] + paid_b)
    market_paid_b = received_a * state["price"] // SCALE
    profit_b = market_paid_b - paid_b
    if received_a <= 0 or profit_b <= 0:
        raise ValueError("整数舍入后没有利润")
    if trader["B"] < paid_b or market["B"] < market_paid_b:
        raise ValueError("套利者或外部市场资金不足")

    trader["B"] -= paid_b
    pool["B"] += paid_b
    pool["A"] -= received_a
    trader["A"] += received_a
    trader["A"] -= received_a
    market["A"] += received_a
    market["B"] -= market_paid_b
    trader["B"] += market_paid_b
    return {"paid_B": paid_b, "received_A": received_a,
            "market_paid_B": market_paid_b, "profit_B": profit_b}


def comparison(state):
    if state["deposited"] is None or state["exited"]:
        raise ValueError("只在投入后、退出前比较")
    pool = state["balances"]["pool"]
    shares = state["lp_shares"]
    claim = {a: pool[a] * shares // state["shares_total"] for a in ("A", "B")}
    held = state["deposited"]
    price = state["price"]
    lp_value = claim["A"] * price // SCALE + claim["B"]
    hold_value = held["A"] * price // SCALE + held["B"]
    return {"claim": claim, "lp_value": lp_value,
            "hold_value": hold_value, "difference": lp_value - hold_value}


def withdraw(state):
    claim = comparison(state)["claim"]
    pool, lp = state["balances"]["pool"], state["balances"]["lp"]
    if any(claim[a] <= 0 for a in ("A", "B")):
        raise ValueError("份额过小，无法取回两种资产")
    for asset in ("A", "B"):
        pool[asset] -= claim[asset]
        lp[asset] += claim[asset]
    state["shares_total"] -= state["lp_shares"]
    state["lp_shares"] = 0
    state["exited"] = True
    return claim


def show(amount):
    return f"{Decimal(amount) / SCALE:.6f}"


def main():
    state = create_state()
    original = totals(state)
    shares = deposit(state, 100 * SCALE)
    assert totals(state) == original
    print(f"投入 100 A + 100 B，获得 {show(shares)} 份；总份额 {show(state['shares_total'])}。")
    set_price(state, 4 * SCALE)
    assert totals(state) == original
    print("外部价格 1 → 4 B/A：此时只改估值，池子仍各有 1100 A/B。")
    trade = arbitrage(state)
    assert totals(state) == original
    print(f"套利者向池子支付 {show(trade['paid_B'])} B、取得 {show(trade['received_A'])} A；")
    print(f"把 A 交给外部市场，市场支付 {show(trade['market_paid_B'])} B，净赚 {show(trade['profit_B'])} B。")
    for actor, label in (("pool", "池子"), ("lp", "LP钱包"),
                         ("arbitrage", "套利者"), ("market", "外部市场")):
        wallet = state["balances"][actor]
        print(f"  {label}余额：{show(wallet['A'])} A / {show(wallet['B'])} B")
    report = comparison(state)
    received = withdraw(state)
    assert totals(state) == original
    print(f"LP 退出 {show(received['A'])} A + {show(received['B'])} B，按同一价格价值 {show(report['lp_value'])} B。")
    print(f"原样持有同批资产价值 {show(report['hold_value'])} B；差额 {show(report['difference'])} B，相对持有 -20%。")
    print(f"A 总量 {show(original['A'])}、B 总量 {show(original['B'])}；每步分别守恒。份额是索取权，不是新增资产。")
    print("这是无手续费、无额外交易的理想对照；网页另演示费率与交易路径，Solidity 另有最小锁定份额。")


if __name__ == "__main__":
    main()
