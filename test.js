var chai = require('chai');
var assert = chai.assert;
var stringify = require('json-stable-stringify');

var RulesEngine = require('./RulesEngine.js');


/** Tests */
describe('RulesEngine', function() {
  this.timeout(5000);
  it('should run', function(done) {
    var r = new RulesEngine();
    assert.equal(typeof r.run, 'function');
    done();
  });
  it('should emit event', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent' });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should emit event if condition is met', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: 'otherRule' });
    r.addRule('otherRule', function(facts) { return true; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should not emit event if condition is not met', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: 'otherRule' });
    r.addRule('otherRule', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    r.updateFacts({ testFact: true }).done(function() {
      done();
    });
  });
  it('should accept multiple conditions (all)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: ['thisRule', 'thatRule'] } });
    r.addRule('thisRule', function(facts) { return true; });
    r.addRule('thatRule', function(facts) { return true; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should accept multiple conditions (any, one true)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { any: ['thisRule', 'thatRule'] } });
    r.addRule('thisRule', function(facts) { return true; });
    r.addRule('thatRule', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should accept multiple conditions (any, both true)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { any: ['thisRule', 'thatRule'] } });
    r.addRule('thisRule', function(facts) { return true; });
    r.addRule('thatRule', function(facts) { return true; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should fail if multiple conditions are not met (any, both false)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { any: ['thisRule', 'thatRule'] } });
    r.addRule('thisRule', function(facts) { return false; });
    r.addRule('thatRule', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    r.updateFacts({ testFact: true }).done(function() {
      done();
    });
  });
  it('should fail if multiple conditions are not met (all, one true one false)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: ['thisRule', 'thatRule'] } });
    r.addRule('thisRule', function(facts) { return true; });
    r.addRule('thatRule', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    r.updateFacts({ testFact: true }).done(function() {
      done();
    });
  });
  it('should fail if multiple conditions are not met (all, both false)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: ['thisRule', 'thatRule'] } });
    r.addRule('thisRule', function(facts) { return false; });
    r.addRule('thatRule', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    r.updateFacts({ testFact: true }).done(function() {
      done();
    });
  });
  it('should accept nested conditions', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } });
    r.addRule('rule1', function(facts) { return true; });
    r.addRule('rule2', function(facts) { return false; });
    r.addRule('rule3', function(facts) { return true; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should fail nested conditions if they are not met', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } });
    r.addRule('rule1', function(facts) { return false; });
    r.addRule('rule2', function(facts) { return true; });
    r.addRule('rule3', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    r.updateFacts({ testFact: true }).done(function() {
      done();
    });
  });
  it('should accept deeply nested conditions', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, {
      events: 'testEvent',
      conditions: {
        all: [{
          any: ['rule2',
            {
              all: ['rule3', {
                any: ['rule4', 'rule5']
              }, {
                any: ['rule6', 'rule7']
              }]
            }
          ]
        },
        'rule1'
        ]
      }
    });
    r.addRule('rule1', function(facts) { return true; });
    r.addRule('rule2', function(facts) { return false; });
    r.addRule('rule3', function(facts) { return true; });
    r.addRule('rule4', function(facts) { return true; });
    r.addRule('rule5', function(facts) { return false; });
    r.addRule('rule6', function(facts) { return true; });
    r.addRule('rule7', function(facts) { return false; });
    r.addEvent('testEvent');
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should evaluate an event given certain facts without triggering other events', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: ['testEvent', 'otherEvent'] });
    r.addEvent('testEvent');
    r.addEvent('otherEvent');
    r.on('testEvent', 'testEventListener', function() { assert.isOk(false); });
    r.on('otherEvent', 'otherEventListener', function() { assert.isOk(false); });
    r.evaluate('testEvent', { testFact: true }).done(function() {
      done();
    });
  });
  it('should evaluate an event and remain in the same state after evaluation (resolve)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: ['testEvent', 'otherEvent'] });
    r.addEvent('testEvent');
    r.addEvent('otherEvent');
    r.on('testEvent', 'testEventListener', function() { assert.isOk(true); });
    r.on('otherEvent', 'otherEventListener', function() { assert.isOk(true); });
    r.rules.sort(function(a, b) {
      return r.rulesMap[a].priority > r.rulesMap[a].priority;
    });
    var temp = stringify(r);
    r.evaluate('testEvent', { testFact: true }).always(function() {
      assert.equal(stringify(r), temp);
      done();
    });
  });
  it('should evaluate an event and remain in the same state after evaluation (reject)', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: ['testEvent', 'otherEvent'] });
    r.addEvent('testEvent');
    r.addEvent('otherEvent');
    r.on('testEvent', 'testEventListener', function() { assert.isOk(true); });
    r.on('otherEvent', 'otherEventListener', function() { assert.isOk(true); });
    r.rules.sort(function(a, b) {
      return r.rulesMap[a].priority > r.rulesMap[a].priority;
    });
    var temp = stringify(r);
    r.evaluate('testEvent', { testFact: false }).always(function() {
      assert.equal(stringify(r), temp);
      done();
    });
  });
  it('should evaluate events with nested conditions without triggering other events', function(done) {
    var r = new RulesEngine();
    var count = 0;
    r.addEvent('testEvent');
    r.addEvent('event1');
    r.addEvent('event2');
    r.addEvent('event3');
    r.addRule('rule1', function(facts) { return true; }, { events: 'event1' });
    r.addRule('rule2', function(facts) { return true; }, { events: 'event2' });
    r.addRule('rule3', function(facts) { return false; }, { events: 'event3' });
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } });
    r.on('testEvent', 'testEventListener', function() { assert.isOk(false);; });
    r.on('event1', 'event1Listener', function() { assert.isOk(false);; });
    r.on('event2', 'event2Listener', function() { assert.isOk(false);; });
    r.on('event3', 'event3Listener', function() { assert.isOk(false);; });
    r.on('rule1', 'rule1Listener', function() { assert.isOk(false);; });
    r.on('rule2', 'rule2Listener', function() { assert.isOk(false);; });
    r.on('rule3', 'rule3Listener', function() { assert.isOk(false);; });
    r.evaluate('testEvent', { testFact: true }).done(function() {
      done();
    });
  });
  it('should be able add many events', function(done) {
    var r = new RulesEngine();
    r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    var count = 0;
    for (var event in r.events) {
      count++;
    }
    assert.equal(count, 4);
    done();
  });
  it('should be able add many rules', function(done) {
    var r = new RulesEngine();
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } }],
      ['rule1', function(facts) { return true; }, { events: 'event1' }],
      ['rule2', function(facts) { return true; }, { events: 'event2' }],
      ['rule3', function(facts) { return true; }, { events: 'event3' }]
    ]);
    var count = 0;
    for (var rule in r.rulesMap) {
      count++;
    }
    assert.equal(count, 4);
    done();
  });
  it('should allow negative conditions', function(done) {
    var r = new RulesEngine();
    r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3'] }, '!rule1'] } }],
      ['rule1', function(facts) { return false; }, { events: 'event1' }],
      ['rule2', function(facts) { return false; }, { events: 'event2' }],
      ['rule3', function(facts) { return false; }, { events: 'event3' }]
    ]);
    r.on('testEvent', '_log_testEvent', function() { done(); });
    r.updateFacts({ testFact: true });
  });
  it('should cache rule results (should not recalculate the same rules in a single run)', function(done) {
    var r = new RulesEngine();
    var count = 0;
    r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { priority: 9, events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
      ['rule1', function(facts) { count++; return false; }, { events: 'event1' }],
      ['rule2', function(facts) { count++; return false; }, { events: 'event2' }],
      ['rule3', function(facts) { count++; return false; }, { events: 'event3' }]
    ]);
    count = 0;
    r.updateFacts({ testFact: true });
    assert.isAtMost(count, 3);
    done();
  });
  it('should cache rule results until facts are updated', function(done) {
    var r = new RulesEngine();
    var count = 0;
    r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
      ['rule1', function(facts) { count++; return false; }, { events: 'event1' }],
      ['rule2', function(facts) { count++; return false; }, { events: 'event2' }],
      ['rule3', function(facts) { count++; return false; }, { events: 'event3' }]
    ]);
    count = 0;
    r.updateFacts({ testFact: true }).always(function() {
      assert.isAtMost(count, 3);
      return r.run();
    }).always(function() {
      assert.isAtMost(count, 3);
      done();
    });
  });
  it('should automatically generate a default event for each rule', function(done) {
    var r = new RulesEngine();
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
      ['rule1', function(facts) { return false; }, { events: 'event1' }],
      ['rule2', function(facts) { return false; }, { events: 'event2' }],
      ['rule3', function(facts) { return false; }, { events: 'event3' }]
    ]);
    assert.equal(Object.keys(r.events).length, 8);
    done();
  });
  it('should prioritize and exit early during individual rule/event evaluation', function(done) {
    var r = new RulesEngine();
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { priority: 777777, events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
      ['rule1', function(facts) { count++; return true; }, { priority: 9, events: 'event1' }],
      ['rule2', function(facts) { count++; return false; }, { priority: 1, events: 'event2' }],
      ['rule3', function(facts) { count++; return false; }, { priority: 2, events: 'event3' }]
    ]);
    var count = 0;
    r.evaluate('rule1').always(function() {
      assert.equal(count, 1);
      done();
    });
  });
  it('should add the rule name as a default event', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; });
    assert.isDefined(r.events.testRule);
    assert.isTrue(r.events.testRule._auto_generated_);
    done();
  });
  it('should remove the default event if the rule is removed', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; });
    r.removeRule('testRule');
    assert.equal(Object.keys(r.events).length, 0);
    done();
  });
  it('should not remove the default event if the rule was defined with that event explicitly', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testRule'});
    r.removeRule('testRule');
    assert.equal(Object.keys(r.events).length, 1);
    done();
  });
  it('should clear cache during evaluation of a rule', function(done) {
    var r = new RulesEngine();
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
      ['rule1', function(facts) { return false; }, { events: 'event1' }],
      ['rule2', function(facts) { return false; }, { events: 'event2' }],
      ['rule3', function(facts) { return false; }, { events: 'event3' }]
    ]);
    r.run({testFact: true});
    assert.equal(Object.keys(r.evaluatedRules).length, 4);
    r.evaluate('testRule', {testFact: false}).fail(function() {
      done();
    });
  });
  it('should evaluate rules in order of priority', function(done) {
    var r = new RulesEngine();
    var prev, start;
    r.addRules([
      ['testRule', function(facts) { start && assert.equal(prev, 3); return facts.testFact; }, { priority: 9, events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
      ['rule1', function(facts) { start && assert.equal(prev, 2); prev = 3; return false; }, { priority: 8, events: 'event1' }],
      ['rule2', function(facts) { start && assert.equal(prev, 1); prev = 2; return false; }, { priority: 3, events: 'event2' }],
      ['rule3', function(facts) { start && assert.equal(prev, 0); prev = 1; return false; }, { priority: 2, events: 'event3' }]
    ]);
    start = true;
    prev = 0;
    r.run({testFact: true});
    done();
  });
});
