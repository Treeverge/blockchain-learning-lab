import requests, time

N1 = "http://localhost:5001"
N2 = "http://localhost:5002"

r1 = requests.get(f"{N1}/chain").json()
r2 = requests.get(f"{N2}/chain").json()
print(f"节点1: {r1['length']}块, 节点2: {r2['length']}块")

# 节点2 挖到超过节点1
while r2['length'] <= r1['length']:
    r = requests.get(f"{N2}/mine")
    r2 = requests.get(f"{N2}/chain").json()
    print(f"  节点2 挖到区块 #{r.json()['index']}, 现在 {r2['length']}块")

print(f"\n节点2({r2['length']}块) 超过节点1({r1['length']}块)!")

# 节点1 执行共识
print("节点1 执行共识算法...")
r = requests.get(f"{N1}/nodes/resolve")
result = r.json()
print(f"结果: {result['message']}")
r1 = requests.get(f"{N1}/chain").json()
print(f"节点1 现在: {r1['length']}块")
if "replaced" in result['message'].lower():
    print(">>> 节点1 放弃了自己的链，采用了节点2 的更长链!")