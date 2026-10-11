"""
Day 2 交互式区块链操作面板
在终端里直接输入命令来操作区块链
"""
import requests
import os

BASE = "http://localhost:5001"

def show_chain():
    r = requests.get(f"{BASE}/chain")
    data = r.json()
    print(f"\n整条链 (共 {data['length']} 个区块):")
    print("-" * 60)
    for block in data['chain']:
        txs = block['transactions']
        tx_str = ", ".join([f"{t['sender']}->{t['recipient']}:{t['amount']}" for t in txs]) if txs else "(空)"
        print(f"  区块 #{block['index']} | proof={block['proof']} | 交易: {tx_str}")
    print("-" * 60)

def mine_block():
    print("\n正在挖矿...")
    r = requests.get(f"{BASE}/mine")
    data = r.json()
    print(f"挖到区块 #{data['index']}!")
    print(f"proof = {data['proof']}")
    print(f"包含 {len(data['transactions'])} 笔交易")

def add_transaction():
    sender = input("  发送者: ").strip()
    recipient = input("  接收者: ").strip()
    amount = input("  金额: ").strip()
    r = requests.post(f"{BASE}/transactions/new", json={
        "sender": sender, "recipient": recipient, "amount": int(amount)
    })
    print(f"  {r.json()['message']}")

def show_menu():
    os.system('cls' if os.name == 'nt' else 'clear')
    print("╔══════════════════════════════════╗")
    print("║   Day 2 区块链交互式操作面板    ║")
    print("╠══════════════════════════════════╣")
    print("║  1. 查看整条链                   ║")
    print("║  2. 挖矿 (打包所有待处理交易)    ║")
    print("║  3. 添加一笔交易                 ║")
    print("║  4. 退出                         ║")
    print("╚══════════════════════════════════╝")
    print()


def main():
    while True:
        show_menu()
        cmd = input("请输入选项 (1-4): ").strip()

        if cmd == "1":
            show_chain()
        elif cmd == "2":
            mine_block()
        elif cmd == "3":
            add_transaction()
        elif cmd == "4":
            print("再见!")
            break
        else:
            print("无效选项")

        input("\n按回车继续...")

if __name__ == "__main__":
    main()