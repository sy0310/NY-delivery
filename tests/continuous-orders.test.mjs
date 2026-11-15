import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderState, createOrder } from '../game/assets/scripts/OrderState.ts';

const finish = order => {
  order.accept(); order.joinQueue(); order.tick(40, true);
  assert.equal(order.take(order.data.code), true);
  order.stow(); order.retrieve();
  assert.equal(order.deliver(), true);
};

test('three orders have unique identities and settle exactly once while keeping shift earnings', () => {
  const order = new OrderState(createOrder(0));
  const ids = new Set();
  let total = 0;
  for (let index = 0; index < 3; index++) {
    ids.add(order.data.id);
    finish(order);
    total += order.data.pay;
    assert.equal(order.deliver(), false);
    assert.equal(order.totalEarnings, total);
    if (index < 2) assert.equal(order.next(createOrder(index + 1)), true);
  }
  assert.equal(ids.size, 3);
  assert.equal(order.completedOrders, 3);
  assert.equal(order.next(createOrder(0)), false);
});

test('next order cannot replace an unfinished order, and resets only current order state', () => {
  const order = new OrderState(createOrder(0));
  assert.equal(order.next(createOrder(1)), false);
  finish(order);
  assert.equal(order.next(createOrder(1)), true);
  assert.equal(order.stage, 'idle');
  assert.equal(order.earnings, 0);
  assert.equal(order.queueJoined, false);
  assert.equal(order.completedOrders, 1);
});

test('phone code, physical bag identity, code and count must match the same order', () => {
  const order = new OrderState(createOrder(2));
  order.accept(); order.joinQueue(); order.tick(40, true);
  const label = {orderId:order.data.id, code:order.data.code, count:order.data.bagCount};
  assert.equal(order.take(order.data.code, {...label, orderId:'wrong'}), false);
  assert.equal(order.take(order.data.code, {...label, code:'0000'}), false);
  assert.equal(order.take(order.data.code, {...label, count:99}), false);
  assert.equal(order.take('0000', label), false);
  assert.equal(order.take(order.data.code, label), true);
});
