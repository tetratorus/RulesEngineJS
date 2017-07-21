var chai = require('chai');
var assert = chai.assert;
var stringify = require('json-stable-stringify');
var $;
var jsdom = require('jsdom-no-contextify');
jsdom.env('', function(err, window) {
    if (err) {
        console.error(err);
        return;
    }

    $ = require('jquery')(window);
});

//***************************************************************//
//  Rules Engine                                                 //
//  NOTE: This module uses jQuery as a dependency                //
//                                                               //
//***************************************************************//
/**
 * Simple rules engine with support for event listeners.
 * @constructor
 * @param {facts} facts - Prepopulate the rules engine with a facts object.
 */
var RulesEngine = function(facts) {
    this.facts = {};
    this.rules = [];
    this.rulesMap = {};
    this.evaluatedRules = {};
    this.events = {};
    this.isEvaluatingFlg = false;
    if (facts !== undefined) {
        this.updateFacts(facts);
    }
};

RulesEngine.prototype.constructor = RulesEngine;

/** Replaces all the facts in the rules engine and triggers a run. */
RulesEngine.prototype.updateFacts = function(facts) {
    deferred = $.Deferred();
    this.evaluatedRules = {};
    this.facts = facts;
    this.run().always(function() {
        deferred.resolve();
    });
    return deferred;
};

/** Adds a rule, accepts three arguments:
    name - name of the rule,
    evaluator - a function which takes facts and outputs a boolean or a jQuery Deferred object
    (addRule will automatically wrap all boolean functions with jQuery.Deferred)
    opts - options for conditions, priority, and events (to be triggered)
 */
RulesEngine.prototype.addRule = function(name, evaluator, opts) {
    if (typeof name !== 'string') return;
    if (typeof evaluator !== 'function') {
        evaluator = function() {
            return $.Deferred().resolve();
        };
    } else if ((evaluator(this.facts) || {}).then === undefined) {
        var temp = evaluator;
        evaluator = (function(orig) {
            return function(input) {
                var deferred = $.Deferred();
                if (orig(input)) {
                    setTimeout(deferred.resolve, 50);
                } else {
                    setTimeout(deferred.reject, 50);
                }
                return deferred;
            };
        })(temp);
    }
    if (Array.isArray(opts) || typeof opts !== 'object') {
        opts = {};
    }
    if (opts.priority === undefined) {
        opts.priority = 9;
    }
    if (!Array.isArray(opts.events)) {
        if (opts.events !== undefined) {
            opts.events = [opts.events];
        } else {
            opts.events = [];
        }
    }
    if (this.rulesMap[name] === undefined) {
        this.rules.push(name);
    }
    if (Array.isArray(opts.events)) {
        for (var i = 0; i < opts.events.length; i++) {
            if (typeof opts.events[i] === 'string') {
                this.addEvent(opts.events[i]);
            }
        }
    } else if (typeof opts.events === 'string') {
        this.addEvent(opts.events);
    }
    if (this.events[name] === undefined) {
        this.addEvent(name);
        Object.defineProperty(this.events[name], '_auto_generated_', {value: true});
    }
    this.rulesMap[name] = {
        name: name,
        events: opts.events,
        test: evaluator,
        priority: opts.priority,
        conditions: opts.conditions // TODO: check for circular dependencies
    };
};

/** Adds many rules */
RulesEngine.prototype.addRules = function(arr) {
    if (!Array.isArray(arr)) return false;
    for (var i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i])) {
            this.addRule.apply(this, arr[i]);
        }
    }
};

/** Removes a rule. */
RulesEngine.prototype.removeRule = function(name) {
    for (var i = 0; i < this.rules.length; i++) {
        if (this.rules[i] === name) {
            this.rules.splice(i, 1);
        }
    }
    delete this.rulesMap[name];
    if (this.events[name] && this.events[name]._auto_generated_ === true) {
        delete this.events[name];
    }
};

/** Registers an event. */
RulesEngine.prototype.addEvent = function(name) {
    this.events[name] = {
        bound: {}
    };
};

/** Registers many events */
RulesEngine.prototype.addEvents = function(arr) {
    if (!Array.isArray(arr)) return false;
    for (var i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i])) {
            this.addEvent.apply(this, arr[i]);
        } else {
            this.addEvent.call(this, arr[i]);
        }
    }
};

/** Removes an event. */
RulesEngine.prototype.removeEvent = function(name) {
    delete this.events[name];
};

/** Emits an event and triggers all handlers bound to that event. */
RulesEngine.prototype.emit = function(event) {
    console.log('HERE', event, this.events[event].bound, this.rules)
    if (this.isEvaluatingFlg) {
        if (this.events[event].bound._evaluation_event !== undefined) {
            this.events[event].bound._evaluation_event(this.facts);
            return true;
        }
        return false; // stop evaluation if return true;
    }
    for (var name in this.events[event].bound) {
        this.events[event].bound[name](this.facts);
    }
    return false;
};

/** Binds a listener to an event. */
RulesEngine.prototype.on = function(event, name, handler) {
    if (this.events[event] === undefined) {
        this.addEvent(event);
    }
    this.events[event].bound[name] = handler;
};

/** Removes a listener for an event by name.
    If name is not specified, all listeners for that event are removed.
 */
RulesEngine.prototype.off = function(event, name) {
    if (name !== undefined) {
        delete this.events[event].bound[name];
    } else {
        this.events[event].bound = {};
    }
};

/** Runs the rules engine and emits events accordingly. */
RulesEngine.prototype.run = function() {
    var exit = false;
    var context = this;
    context.rules.sort(function(a, b) {
        return context.rulesMap[a].priority > context.rulesMap[b].priority;
    });
    var evaluateConditions = function(conditions) {
        var deferred = $.Deferred();
        if (exit) return deferred.resolve();
        if (conditions === undefined) {
            return deferred.resolve();
        }
        var deferredArray = [];
        if (conditions.all !== undefined) {
            for (var i = 0; i < conditions.all.length; i++) {
                deferredArray.push(evaluateConditions(conditions.all[i]));
            }
            $.when.apply($, deferredArray)
                .done(function() {
                    deferred.resolve();
                }).fail(function() {
                    deferred.reject();
                });
        } else if (conditions.any !== undefined) {
            for (var i = 0; i < conditions.any.length; i++) {
                deferredArray.push((function() {
                    var deferred = $.Deferred();
                    evaluateConditions(conditions.any[i])
                        .done(function() {
                            deferred.reject();
                        })
                        .fail(function() {
                            deferred.resolve();
                        });
                    return deferred;
                })());
            }
            $.when.apply($, deferredArray)
                .done(function() {
                    deferred.reject();
                }).fail(function() {
                    deferred.resolve();
                });
        } else {
            var name = conditions;
            var opposite = false;
            if (typeof name !== 'string') {
                deferred.reject();
            } else {
                if (name.charAt(0) === '!') {
                    opposite = true;
                    name = name.slice(1);
                }
                if (context.rulesMap[name] !== undefined && opposite === false) {
                    evaluateRule(context.rulesMap[name])
                        .done(function() {
                            deferred.resolve();
                        })
                        .fail(function() {
                            deferred.reject();
                        });
                } else if (context.rulesMap[name] !== undefined && opposite === true) {
                    evaluateRule(context.rulesMap[name])
                        .done(function() {
                            deferred.reject();
                        })
                        .fail(function() {
                            deferred.resolve();
                        });
                } else {
                    deferred.reject();
                }
            }

        }

        return deferred;
    };
    var evaluateRule = function(rule) {
        var deferred = $.Deferred();
        if (exit) return deferred.resolve();
        if (rule === undefined) return deferred.resolve();
        if (context.evaluatedRules[rule.name] === true) return deferred.resolve();
        if (context.evaluatedRules[rule.name] === false) return deferred.reject();
        // check if conditions are satisfied first
        if (rule.conditions !== undefined) {
            evaluateConditions(rule.conditions)
                .done(function() {
                    rule.test(context.facts)
                        .done(function() {
                            context.evaluatedRules[rule.name] = true;
                            for (var i = 0; i < rule.events.length; i++) {
                                if (context.emit(rule.events[i]) === true) { console.log('NO EXIT', context.rules); exit = true; }
                            }
                            deferred.resolve();
                        }).fail(function() {
                            context.evaluatedRules[rule.name] = false;
                            deferred.reject();
                        });
                })
                .fail(function() {
                    deferred.reject();
                });
        } else {
            rule.test(context.facts)
                .done(function() {
                    context.evaluatedRules[rule.name] = true;
                    for (var i = 0; i < rule.events.length; i++) {
                        if (context.emit(rule.events[i]) === true) { console.log('NO EXIT'); exit = true; }
                    }
                    deferred.resolve();
                })
                .fail(function() {
                    context.evaluatedRules[rule.name] = false;
                    deferred.reject();
                });
        }

        return deferred;
    };
    if (Object.keys(context.rulesMap).length === 0) {
        return $.Deferred().resolve();
    }
    var deferred = evaluateRule(context.rulesMap[context.rules[0]])
    for (var i = 1; i < context.rules.length; i++) {
        deferred = deferred.always(function() {
            if (exit) deferred.resolve();
            return evaluateRule(context.rulesMap[context.rules[i]]);
        });
    }
    return deferred;
};

/** Evaluates the rules engine against a set of facts without triggering any existing event listeners.
    Used to test a listener against a set of facts.
 */
RulesEngine.prototype.evaluate = function(event, facts) {
    var deferred = $.Deferred();
    var tempFacts = this.facts;
    var tempEvaluatedRules = JSON.stringify(this.evaluatedRules);
    var tempPriority;
    var context = this;
    if (facts !== undefined) {
        this.facts = facts;
    }
    if (this.rulesMap[event] && this.events[event]._auto_generated_ === true) {
        tempPriority = this.rulesMap[event].priority;
        this.rulesMap[event].priority = -Infinity;
    }
    this.isEvaluatingFlg = true;
    this.on(event, '_evaluation_event', function(facts) {
        console.log('PROBLEM SOLVED')
        context.off(event, '_evaluation_event');
        context.facts = tempFacts;
        context.evaluatedRules = JSON.parse(tempEvaluatedRules);
        if (tempPriority !== undefined) {
            context.rulesMap[event].priority = tempPriority;
        }
        context.isEvaluatingFlg = false;
        deferred.resolve();
    });
    this.run().always(function() {
        context.isEvaluatingFlg = false;
        deferred.reject();
    });
    return deferred;
};


/** Tests */
describe('RulesEngine', function() {
    this.timeout(5000);
    // it('should run', function(done) {
    //     var r = new RulesEngine();
    //     assert.equal(typeof r.run, 'function');
    //     done();
    // });
    // it('should emit event', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent' });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should emit event if condition is met', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: 'otherRule' });
    //     r.addRule('otherRule', function(facts) { return true; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should not emit event if condition is not met', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: 'otherRule' });
    //     r.addRule('otherRule', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    //     r.updateFacts({ testFact: true }).done(function() {
    //         done();
    //     });
    // });
    // it('should accept multiple conditions (all)', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: ['thisRule', 'thatRule'] } });
    //     r.addRule('thisRule', function(facts) { return true; });
    //     r.addRule('thatRule', function(facts) { return true; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should accept multiple conditions (any, one true)', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { any: ['thisRule', 'thatRule'] } });
    //     r.addRule('thisRule', function(facts) { return true; });
    //     r.addRule('thatRule', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should accept multiple conditions (any, both true)', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { any: ['thisRule', 'thatRule'] } });
    //     r.addRule('thisRule', function(facts) { return true; });
    //     r.addRule('thatRule', function(facts) { return true; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should fail if multiple conditions are not met (any, both false)', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { any: ['thisRule', 'thatRule'] } });
    //     r.addRule('thisRule', function(facts) { return false; });
    //     r.addRule('thatRule', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    //     r.updateFacts({ testFact: true }).done(function() {
    //         done();
    //     });
    // });
    // it('should fail if multiple conditions are not met (all, one true one false)', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: ['thisRule', 'thatRule'] } });
    //     r.addRule('thisRule', function(facts) { return true; });
    //     r.addRule('thatRule', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    //     r.updateFacts({ testFact: true }).done(function() {
    //         done();
    //     });
    // });
    // it('should fail if multiple conditions are not met (all, both false)', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: ['thisRule', 'thatRule'] } });
    //     r.addRule('thisRule', function(facts) { return false; });
    //     r.addRule('thatRule', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    //     r.updateFacts({ testFact: true }).done(function() {
    //         done();
    //     });
    // });
    // it('should accept nested conditions', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } });
    //     r.addRule('rule1', function(facts) { return true; });
    //     r.addRule('rule2', function(facts) { return false; });
    //     r.addRule('rule3', function(facts) { return true; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should fail nested conditions if they are not met', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } });
    //     r.addRule('rule1', function(facts) { return false; });
    //     r.addRule('rule2', function(facts) { return true; });
    //     r.addRule('rule3', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { assert.isOk(false); });
    //     r.updateFacts({ testFact: true }).done(function() {
    //         done();
    //     });
    // });
    // it('should accept deeply nested conditions', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, {
    //         events: 'testEvent',
    //         conditions: {
    //             all: [{
    //                     any: ['rule2',
    //                         {
    //                             all: ['rule3', {
    //                                 any: ['rule4', 'rule5']
    //                             }, {
    //                                 any: ['rule6', 'rule7']
    //                             }]
    //                         }
    //                     ]
    //                 },
    //                 'rule1'
    //             ]
    //         }
    //     });
    //     r.addRule('rule1', function(facts) { return true; });
    //     r.addRule('rule2', function(facts) { return false; });
    //     r.addRule('rule3', function(facts) { return true; });
    //     r.addRule('rule4', function(facts) { return true; });
    //     r.addRule('rule5', function(facts) { return false; });
    //     r.addRule('rule6', function(facts) { return true; });
    //     r.addRule('rule7', function(facts) { return false; });
    //     r.addEvent('testEvent');
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should evaluate an event given certain facts without triggering other events', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: ['testEvent', 'otherEvent'] });
    //     r.addEvent('testEvent');
    //     r.addEvent('otherEvent');
    //     r.on('testEvent', 'testEventListener', function() { assert.isOk(false); });
    //     r.on('otherEvent', 'otherEventListener', function() { assert.isOk(false); });
    //     r.evaluate('testEvent', { testFact: true }).done(function() {
    //         done();
    //     });
    // });
    // it('should evaluate an event and remain in the same state after evaluation', function(done) {
    //     var r = new RulesEngine();
    //     r.addRule('testRule', function(facts) { return facts.testFact; }, { events: ['testEvent', 'otherEvent'] });
    //     r.addEvent('testEvent');
    //     r.addEvent('otherEvent');
    //     r.on('testEvent', 'testEventListener', function() { assert.isOk(false); });
    //     r.on('otherEvent', 'otherEventListener', function() { assert.isOk(false); });
    //     r.rules.sort(function(a, b) {
    //         return r.rulesMap[a].priority > r.rulesMap[a].priority;
    //     });
    //     var temp = stringify(r);
    //     r.evaluate('testEvent', { testFact: true }).done(function() {
    //         assert.equal(stringify(r), temp);
    //         done();
    //     });
    // });
    it('should evaluate events with nested conditions without triggering other events', function(done) {
        var r = new RulesEngine();
        r.addEvent('testEvent');
        r.addEvent('event1');
        r.addEvent('event2');
        r.addEvent('event3');
        r.addRule('rule1', function(facts) { return true; }, { events: 'event1' });
        r.addRule('rule2', function(facts) { return true; }, { events: 'event2' });
        r.addRule('rule3', function(facts) { return false; }, { events: 'event3' });
        r.addRule('testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } });
        r.on('testEvent', 'testEventListener', function() { assert.isOk(false); });
        r.on('event1', 'event1Listener', function() { assert.isOk(false); });
        r.on('event2', 'event2Listener', function() { assert.isOk(false); });
        r.on('event3', 'event3Listener', function() { assert.isOk(false); });
        r.on('rule1', 'rule1Listener', function() { assert.isOk(false); });
        r.on('rule2', 'rule2Listener', function() { assert.isOk(false); });
        r.on('rule3', 'rule3Listener', function() { assert.isOk(false); });
        r.evaluate('testEvent', { testFact: true }).fail(function() {
            done();
        });
    });
    // it('should be able add many events', function(done) {
    //     var r = new RulesEngine();
    //     r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    //     var count = 0;
    //     for (var event in r.events) {
    //         count++;
    //     }
    //     assert.equal(count, 4);
    //     done();
    // });
    // it('should be able add many rules', function(done) {
    //     var r = new RulesEngine();
    //     r.addRules([
    //         ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['rule2', 'rule3'] }, 'rule1'] } }],
    //         ['rule1', function(facts) { return true; }, { events: 'event1' }],
    //         ['rule2', function(facts) { return true; }, { events: 'event2' }],
    //         ['rule3', function(facts) { return true; }, { events: 'event3' }]
    //     ]);
    //     var count = 0;
    //     for (var rule in r.rulesMap) {
    //         count++;
    //     }
    //     assert.equal(count, 4);
    //     done();
    // });
    // it('should allow negative conditions', function(done) {
    //     var r = new RulesEngine();
    //     r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    //     r.addRules([
    //         ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3'] }, '!rule1'] } }],
    //         ['rule1', function(facts) { return false; }, { events: 'event1' }],
    //         ['rule2', function(facts) { return false; }, { events: 'event2' }],
    //         ['rule3', function(facts) { return false; }, { events: 'event3' }]
    //     ]);
    //     r.on('testEvent', '_log_testEvent', function() { done(); });
    //     r.updateFacts({ testFact: true });
    // });
    // it('should cache rule results (should not recalculate the same rules in a single run)', function(done) {
    //     var r = new RulesEngine();
    //     var count = 0;
    //     r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    //     r.addRules([
    //         ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
    //         ['rule1', function(facts) { count++; return false; }, { events: 'event1' }],
    //         ['rule2', function(facts) { count++; return false; }, { events: 'event2' }],
    //         ['rule3', function(facts) { count++; return false; }, { events: 'event3' }]
    //     ]);
    //     count = 0;
    //     r.updateFacts({ testFact: true });
    //     assert.isAtMost(count, 3);
    //     done();
    // });
    // it('should cache rule results until facts are updated', function(done) {
    //     var r = new RulesEngine();
    //     var count = 0;
    //     r.addEvents(['testEvent', 'event1', 'event2', 'event3']);
    //     r.addRules([
    //         ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
    //         ['rule1', function(facts) { count++; return false; }, { events: 'event1' }],
    //         ['rule2', function(facts) { count++; return false; }, { events: 'event2' }],
    //         ['rule3', function(facts) { count++; return false; }, { events: 'event3' }]
    //     ]);
    //     count = 0;
    //     r.updateFacts({ testFact: true }).always(function() {
    //         assert.isAtMost(count, 3);
    //         return r.run();
    //     }).always(function() {
    //         assert.isAtMost(count, 3);
    //         done();
    //     });
    // });
    // it('should automatically generate a default event for each rule', function(done) {
    //     var r = new RulesEngine();
    //     r.addRules([
    //         ['testRule', function(facts) { return facts.testFact; }, { events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
    //         ['rule1', function(facts) { return false; }, { events: 'event1' }],
    //         ['rule2', function(facts) { return false; }, { events: 'event2' }],
    //         ['rule3', function(facts) { return false; }, { events: 'event3' }]
    //     ]);
    //     assert.equal(Object.keys(r.events).length, 8);
    //     done();
    // });
    // it('should prioritize and exit early during individual rule/event evaluation', function(done) {
    //     var r = new RulesEngine();
    //     r.addRules([
    //         ['testRule', function(facts) { return facts.testFact; }, { priority: 777777, events: 'testEvent', conditions: { all: [{ any: ['!rule2', 'rule3', 'rule1'] }, '!rule1', '!rule2'] } }],
    //         ['rule1', function(facts) { count++; return true; }, { priority: 9, events: 'event1' }],
    //         ['rule2', function(facts) { count++; return false; }, { priority: 1, events: 'event2' }],
    //         ['rule3', function(facts) { count++; return false; }, { priority: 2, events: 'event3' }]
    //     ]);
    //     var count = 0;
    //     r.evaluate('rule1').always(function() {
    //         assert.equal(count, 1)
    //         done();
    //     })
    // })
    // tests for rule priority
});
