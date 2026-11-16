import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderState, DEMO_ORDER } from '../game/assets/scripts/OrderState.ts';

test('one order completes once, with one shared order and a fresh restart', () => {
  const order = new OrderState();
  assert.equal(order.data.code, '4826');
  assert.equal(order.take('4826'), false);
  assert.equal(order.deliver(), false);
  assert.equal(order.stow(), false);
  assert.equal(order.joinQueue(), false);
  assert.equal(order.accept(), true);
  assert.equal(order.accept(), false);
  assert.equal(order.joinQueue(), true);
  assert.equal(order.joinQueue(), false);
  order.tick(40, true);
  assert.equal(order.take('4826'), true);
  assert.equal(order.take('4826'), false);
  assert.equal(order.deliver(), false);
  assert.equal(order.stow(), true);
  assert.equal(order.stow(), false);
  assert.equal(order.deliver(), false);
  assert.equal(order.retrieve(), true);
  assert.equal(order.retrieve(), false);
  assert.equal(order.deliver(), true);
  assert.equal(order.deliver(), false);
  assert.equal(order.earnings, DEMO_ORDER.pay);
  order.restart();
  assert.equal(order.stage, 'idle');
  assert.equal(order.earnings, 0);
  assert.equal(order.queueRemaining, 8);
  assert.equal(order.kitchenRemaining, 24);
  assert.equal(order.accept(), true);
});

test('queue and kitchen are independent and survive leaving the restaurant', () => {
  const order = new OrderState();
  order.accept();
  order.tick(4, false);
  assert.equal(order.kitchenRemaining, 20);
  assert.equal(order.queueRemaining, 8);
  order.joinQueue();
  order.tick(3, true);
  order.tick(30, false);
  assert.equal(order.kitchenRemaining, 0);
  assert.equal(order.queueRemaining, 5);
  assert.equal(order.take('4826'), false);
  order.tick(5, true);
  assert.equal(order.take('0000'), false);
  assert.equal(order.stage, 'accepted');
  assert.equal(order.take('4826'), true);
});

test('replacement order data drives code and pay, and invalid time is ignored', () => {
  const order = new OrderState({ ...DEMO_ORDER, code: '9999', pay: 12.5 });
  order.tick(100, true);
  assert.equal(order.kitchenRemaining, 24);
  order.accept();
  order.joinQueue();
  for (const dt of [-1, NaN, Infinity]) order.tick(dt, true);
  assert.equal(order.queueRemaining, 8);
  order.tick(30, true);
  assert.equal(order.take('4826'), false);
  assert.equal(order.take('9999'), true);
  order.stow();
  order.retrieve();
  order.deliver();
  assert.equal(order.earnings, 12.5);
  order.restart();
  assert.equal(order.data.code, '9999');
});

test('delivery bag must leave the car and can be safely stowed again', () => {
  const order = new OrderState();
  assert.equal(order.retrieve(), false);
  order.accept();
  order.joinQueue();
  order.tick(30, true);
  order.take('4826');
  order.stow();
  assert.equal(order.deliver(), false);
  assert.equal(order.retrieve(), true);
  assert.equal(order.stage, 'delivering');
  assert.equal(order.stow(), true);
  assert.equal(order.deliver(), false);
  order.retrieve();
  assert.equal(order.deliver(), true);
});
