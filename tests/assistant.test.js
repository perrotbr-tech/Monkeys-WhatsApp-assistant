'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateReply, HELP_TEXT } = require('../src/assistant');

test('empty message asks for help', () => {
  assert.match(generateReply(''), /help/i);
});

test('help returns the help text', () => {
  assert.equal(generateReply('help'), HELP_TEXT);
  assert.equal(generateReply('  MENU '), HELP_TEXT);
});

test('ping returns pong', () => {
  assert.equal(generateReply('ping'), 'pong');
});

test('time uses injected clock', () => {
  const fixed = new Date('2020-01-02T03:04:05.000Z');
  assert.equal(
    generateReply('time', { now: () => fixed }),
    'Server time: 2020-01-02T03:04:05.000Z',
  );
});

test('echo repeats the text after the command', () => {
  assert.equal(generateReply('echo Hello World'), 'Hello World');
});

test('greetings get a friendly reply', () => {
  assert.match(generateReply('Hello'), /Monkeys assistant/);
});

test('unknown input echoes back with a hint', () => {
  const reply = generateReply('do a backflip');
  assert.match(reply, /do a backflip/);
  assert.match(reply, /help/);
});
