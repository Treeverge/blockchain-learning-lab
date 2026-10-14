"""有界重入教学执行器：资金、债权、回调和分层回滚。无真实链/Gas。"""
from copy import deepcopy

NAMES = ('Alice', 'Bob', 'Attacker')


def create_state():
    return {'cash': 6, 'claims': {'Alice': 3, 'Bob': 2, 'Attacker': 1},
            'wallets': dict.fromkeys(NAMES, 0), 'locked': False}


def totals(state):
    claims = sum(state['claims'].values())
    return {'claims': claims, 'assets': state['cash'] + sum(state['wallets'].values()),
            'gap': max(claims - state['cash'], 0)}


def run(initial, mode='vulnerable', caller='Attacker', max_payouts=6,
        catch_failure=True, receiver_reject=False):
    if (mode not in ('vulnerable', 'cei', 'lock') or caller not in NAMES
            or type(max_payouts) is not int or not 1 <= max_payouts <= 8
            or type(catch_failure) is not bool or type(receiver_reject) is not bool):
        raise ValueError('无效场景；接收次数必须为1至8的整数')
    if (type(initial['cash']) is not int or initial['cash'] < 0
            or type(initial['locked']) is not bool
            or any(type(initial[k][n]) is not int or initial[k][n] < 0
                   for k in ('claims', 'wallets') for n in NAMES)):
        raise ValueError('账本格式不正确')
    state, trace, logs, payments = deepcopy(initial), [], [], 0

    def mark(kind, text, depth):
        trace.append({'kind': kind, 'text': text, 'depth': depth, 'state': deepcopy(state)})

    def withdraw(depth):
        nonlocal state, payments
        before, old_logs, old_payments = deepcopy(state), len(logs), payments
        mark('enter', f'{caller}进入withdraw', depth)
        try:
            if mode == 'lock':
                if state['locked']:
                    raise ValueError('重入锁已占用')
                state['locked'] = True
                mark('lock', '加锁', depth)
            value = state['claims'][caller]
            if value == 0:
                raise ValueError('债权已为0')
            if mode == 'cei':
                state['claims'][caller] = 0
                mark('effects', '先清债权', depth)
            if state['cash'] < value:
                raise ValueError('银行实际资金不足')
            state['cash'] -= value
            state['wallets'][caller] += value
            payments += 1
            mark('transfer', f'临时转出{value} G', depth)
            mark('callback', '接收者获得控制权', depth)
            if receiver_reject:
                raise ValueError('接收合约主动拒收')
            if caller == 'Attacker' and payments < max_payouts:
                mark('reenter', '尝试重入', depth)
                try:
                    withdraw(depth + 1)
                except ValueError as error:
                    if not catch_failure:
                        raise ValueError(f'内层失败向外传播：{error}') from error
                    mark('caught', f'捕获内层失败：{error}', depth)
            mark('return', '外部调用返回', depth)
            if mode != 'cei':
                state['claims'][caller] = 0
                mark('effects', '后清债权', depth)
            if mode == 'lock':
                state['locked'] = False
                mark('unlock', '解锁', depth)
            logs.append({'caller': caller, 'value': value})
            mark('exit', '本层完成', depth)
        except ValueError as error:
            state, payments = before, old_payments
            del logs[old_logs:]
            mark('rollback', f'本层及后代恢复：{error}', depth)
            raise

    mark('start', '存款此前已完成，本事务只提款', 0)
    success, reason = True, '提款提交成功'
    try:
        withdraw(1)
    except ValueError as error:
        success, reason = False, str(error)
    mark('final', '提交成功分支' if success else '整笔提款回滚，先前存款保留', 0)
    return {'state': state, 'trace': trace, 'logs': logs,
            'success': success, 'reason': reason, 'payments': payments}


def main():
    for mode in ('vulnerable', 'cei', 'lock'):
        result = run(create_state(), mode=mode)
        state = result['state']
        print(f'\n{mode}: 成功={result["success"]}, 银行现金={state["cash"]}, '
              f'攻击合约接收={state["wallets"]["Attacker"]}, 对账={totals(state)}')
    result = run(create_state(), mode='cei', catch_failure=False)
    print('\nCEI + 内层失败传播：', result['reason'])
    print('最终账本：', result['state'])
    print('\n债权不是现金。网页与本文件不计Gas；真实VM中的失败事务仍付执行费。')


if __name__ == '__main__':
    main()
