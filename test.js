var chai = require('chai');
var assert = chai.assert;
var stringify = require('json-stable-stringify');
var RulesEngine = require('./src/RulesEngine.js');
var jsdom, $;
try {
  jsdom = require('jsdom-no-contextify');
  jsdom.env('', function(err, window) {
    if (err) {
      console.error(err);
      return;
    }
    $ = require('jquery')(window);
  });
} catch (e) {
  try {
    $ = require('./src/Deferred.js');
  } catch (e) {
    $ = !function(e,n){if("function"==typeof define&&define.amd)define(n);else{var r=n();"object"!=typeof module?e[r.name]=r:module.exports=r;}}(this,function(){var e="done fail isResolved isRejected promise then always pipe".split(" "),n=[].slice,r={_Deferred:function(){var e,n,r,t=[],i={done:function(){if(!r){var n,o,f,l,s,c=arguments;for(e&&(s=e,e=0),n=0,o=c.length;n<o;n++)l=typeof(f=c[n]),Array.isArray(f)&&(l="array"),"array"===l?i.done.apply(i,f):"function"===l&&t.push(f);s&&i.resolveWith(s[0],s[1]);}return this;},resolveWith:function(i,o){if(!r&&!e&&!n){o=o||[],n=1;try{for(;t[0];)t.shift().apply(i,o);}finally{e=[i,o],n=0;}}return this;},resolve:function(){return i.resolveWith(this,arguments),this;},isResolved:function(){return!(!n&&!e);},cancel:function(){return r=1,t=[],this;}};return i;},Deferred:function(n){var t,i=r._Deferred(),o=r._Deferred(),f={then:function(e,n){return i.done(e).fail(n),this;},always:function(){return i.done.apply(i,arguments).fail.apply(this,arguments);},fail:o.done,rejectWith:o.resolveWith,reject:o.resolve,isRejected:o.isResolved,pipe:function(e,n){return r.Deferred(function(r){var t={done:[e,"resolve"],fail:[n,"reject"]};for(var o in t)!function(e,n){var t,o=n[0],f=n[1];"function"==typeof o?i[e](function(){(t=o.apply(this,arguments))&&"function"==typeof t.promise?t.promise().then(r.resolve,r.reject):r[f](t);}):i[e](r[f]);}(o,t[o]);}).promise();},promise:function(n){if(null==n){if(t)return t;t=n={};}for(var r=e.length;r--;)n[e[r]]=i[e[r]];return n;}};for(var l in f)i[l]=f[l];return i.done(o.cancel).fail(i.cancel),delete i.cancel,n&&n.call(i,i),i;},when:function(e){var t=arguments,i=0,o=t.length,f=o,l=o<=1&&e&&"function"==typeof e.promise?e:r.Deferred();if(o>1){for(;i<o;i++)t[i]&&"function"==typeof t[i].promise?t[i].promise().then(function(e){return function(r){t[e]=arguments.length>1?n.call(arguments,0):r,--f||l.resolveWith(l,n.call(t,0));};}(i),l.reject):--f;f||l.resolveWith(l,t);}else l!==e&&l.resolveWith(l,o?[e]:[]);return l.promise();}};return r;});
  }
}



/** Tests */
describe('RulesEngine', function() {
  this.timeout(1000);
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
    r.on('otherEvent', 'otherEventListener', function() { debugger; assert.isOk(false); });
    debugger;
    r.evaluate('testEvent', { testFact: true }).done(function() {
      setTimeout(function() {
        !r.isRunningFlg && done();
      },10);
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
      setTimeout(function() {
        assert.equal(stringify(r), temp);
        done();
      }, 100);
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
      setTimeout(function() {
        assert.equal(stringify(r), temp);
        done();
      }, 100);
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
    }).done(function() {
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
      ['rule3', function(facts) { count++; return false; }, { priority: 2, events: 'event3' }],
      ['rule4', undefined, {conditions: '!rule1'}]
    ]);
    var count = 0;
    r.evaluate('rule1').always(function() {
      assert.equal(count, 1);
      count = 0;
      r.evaluate('rule4').always(function() {
        assert.equal(count, 1);
        done();
      });
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
  it('should accept a promise library in place of jQuery', function(done) {
    if ($ === 'MODULE_NOT_FOUND') return this.skip();
    var temp = $.Deferred;
    var flag = false;
    $.Deferred = function() {
      flag = true;
      return temp.apply($, arguments);
    };
    var r = new RulesEngine($);
    r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    r.addRules([
      ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3'] }, '!rule1'] } }],
      ['rule1', function(facts) { return false; }, { events: 'event1' }],
      ['rule2', function(facts) { return false; }, { events: 'event2' }],
      ['rule3', function(facts) { return false; }, { events: 'event3' }]
    ]);
    r.on('testEvent', '_log_testEvent', function() { flag ? done() : assert.isOk(false); });
    r.updateFacts({ testFact: true });
  });
  it('should return a deep copy of facts', function(done) {
    var r = new RulesEngine();
    r.facts = {c: {d: {e: [1,2,3,4,5]}}};
    assert.isOk(r.facts !== r.getFacts());
    assert.deepEqual(r.facts, r.getFacts());
    done();
  });
  it('should be able to access nested facts using "getFacts"', function(done) {
    var r = new RulesEngine();
    r.facts = {a: {b: {c: 3}}};
    try {
      r.addRule('testRule1', function(facts) { return facts.a.b.c.d.e; });
    } catch (e) {
      assert.isOk(true);
    }
    r.addRule('testRule2', function() { return r.getFacts('a.b.c'); });
    r.addRule('testRule3', function() { return r.getFacts('a.b.c.d'); });
    done();
  });
  it('should be correctly evaluate async rules', function(done) {
    if ($ === 'MODULE_NOT_FOUND') return this.skip();
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) {
      var deferred = $.Deferred();
      setTimeout(function() {
        if (facts.testFact) {
          deferred.resolve();
        } else {
          deferred.reject();
        }
      }, 500);
      return deferred;
    });
    var flag = false;
    r.on('testRule', 'handler', function() {
      flag = true;
      done();
    });
    r.updateFacts({testFact: true}).done(function() {
      if (!flag) assert.isOk(false);
    });
  });
  it('should resolve all evaluated rules to boolean after run is complete', function(done) {
    if ($ === 'MODULE_NOT_FOUND') return this.skip();
    var r = new RulesEngine();
    r.addRule('rule1', function(facts) {
      var deferred = $.Deferred();
      setTimeout(function() {
        if (facts.testFact) {
          deferred.resolve();
        } else {
          deferred.reject();
        }
      }, 500);
      return deferred;
    });
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
    r.addRule('rule2', function(facts) { return false; });
    r.addRule('rule3', function(facts) { return true; });
    r.addRule('rule4', function(facts) { return true; });
    r.addRule('rule5', function(facts) { return false; });
    r.addRule('rule6', function(facts) { return true; });
    r.addRule('rule7', function(facts) { return false; });
    r.evaluate('testRule', {testFact: true})
    .done(function() {
      for (var i = 0; i < r.evaluatedRules.length; i++) {
        assert.typeOf(r.evaluatedRules[i], 'string');
      }
      done();
    })
    .fail(function() {
      assert.isOk(false);
    });
  });
  it('should queue simultaneous runs', function(done) {
    var r = new RulesEngine();
    r.addRule('testRule', function(facts) {
      return true;
    });
    for (var i = 0; i < 10; i++) {
      r.run();
    }
    assert.equal(r.queue.length, 9);
    done();
  });
  it('should not execute next run before a run is completed', function(done) {
    var r = new RulesEngine();
    var count = 0;
    var count2 = 0;
    r.addRule('testRule', function(facts) {
      count2++;
      count++;
      assert.isAtMost(count, 1);
      var deferred = $.Deferred();
      if (facts.testFact) {
        setTimeout(function() {
          count--;
          deferred.resolve();
        }, 100);
      } else {
        setTimeout(function() {
          deferred.reject();
        }, 100);
      }
      return deferred;
    });
    r.facts = {testFact: true};
    count = 0;
    count2 = 0;
    for (var i = 0; i < 3; i++) {
      r.updateFacts(r.facts).done((function(j) {
        return function() {
          assert.isAtMost(count, 1);
          if (j === 2) {
            assert.equal(count2, 3);
            done();
          }
        };
      })(i));
    }
  });
  it('should not crash even if rules throw errors', function(done) {
    var r = new RulesEngine();
    r._log = function() {};
    var count = 0;
    var count2 = 0;
    var count3 = 0;
    r.addRule('testRule', function(facts) {
      count++;
      if (count > 1) {
        throw new Error('testRule errored out');
      }
      return facts.testFacts;
    }, { priority: 2 });
    r.addRule('rule1', function(facts) {
      return true;
    }, { priority: 1 });
    r.addRule('rule2', function(facts) {
      return true;
    }, { priority: 3})
    r.on('rule1', 'rule1_handler', function() { count2++; });
    r.on('rule2', 'rule2_handler', function() { count3++; });
    r.updateFacts({ testFact: true });
    r.updateFacts({ testFact: true}).done(function() {
      if (count === 3 && count2 === 2 && count3 === 2) {
        done();
      } else {
        console.log(count, count2, count3);
        assert.isOk(false);
      }
    });
  });
  this.timeout(5000);
  it('should timeout and reject an async rule evaluation if it\'s too slow (>3s)', function(done) {
    var r = new RulesEngine();
    var flag = false;
    r._log = function() { flag = true; };
    r.addRule('testRule', function(facts) {
      var deferred = $.Deferred();
      setTimeout(deferred.resolve, 3500);
      return deferred;
    })
    r.addRule('rule1', undefined, {conditions: '!testRule'});
    r.on('rule1', 'rule1_handler', function() {
      flag && done();
    })
    r.run();
  });
  this.timeout(11000);
  it('should timeout if the engine is running for too long (>10s)', function(done) {
    var r = new RulesEngine();
    var flag = false;
    r._log = function() { flag = true; };
    var flag2 = false;
    r.addRule('rule1', function() {flag2 && console.log('rule1 eval'); return true;}, {conditions: 'rule2'});
    r.addRule('rule2', function() {flag2 && console.log('rule2 eval'); return true;}, {conditions: 'rule1'});
    flag2 = true;
    r.run().always(function() {
      if (flag) {
        setTimeout(function() {
          !r.isRunningFlg && done();
        }, 10);
      }
    });
  });
  this.timeout(1000);
});
