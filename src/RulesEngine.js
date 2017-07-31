(function(scope, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
    return;
  }

  var instance = factory();

  if (typeof module === 'object') {
    module.exports = instance;
    return;
  }
  scope[instance.name] = instance;
})(this, function() {
  var jQuery;
  if (typeof $ === 'undefined') {
    var jsdom = require('jsdom-no-contextify');
    jsdom.env('', function(err, window) {
      if (err) {
        console.error(err);
        return;
      }
      $ = require('jquery')(window);
      jQuery = $;
    });
  }
  //***************************************************************//
  //  Rules Engine                                                 //
  //  NOTE: This module uses jQuery as a dependency                //
  //                                                               //
  //***************************************************************//
  /**
	 * Simple rules engine with support for event listeners.
	 * @constructor
	 * @param {Promise} Promise - accepts a promise library in place of jQuery.
	 */

  var RulesEngine = function(Promise) {
    this.facts = {};
    this.rules = [];
    this.rulesMap = {};
    this.evaluatedRules = {};
    this.events = {};
    this.isEvaluatingFlg = false;
    if (Promise !== undefined) {
      jQuery = Promise;
    }
  };

  RulesEngine.prototype.constructor = RulesEngine;

  /** Replaces all the facts in the rules engine and triggers a run. */
  RulesEngine.prototype.updateFacts = function(facts, value) {
    var deferred = jQuery.Deferred();
    if (typeof facts === 'object') {
      this.evaluatedRules = {};
      this.facts = facts;
      this.run().always(function() {
        deferred.resolve();
      });
      return deferred;
    }
  };

  RulesEngine.prototype.getFacts = function(accessor) {
    var res = JSON.parse(JSON.stringify(this.facts));
    if (accessor === undefined || typeof accessor !== 'string') return res;
    var arr = accessor.split('.');
    for (var i = 0; i < arr.length; i++) {
      res = res[arr[i]];
      if (res === undefined) return undefined;
    }
    return res;
  }

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
        return jQuery.Deferred().resolve();
      };
    } else if ((evaluator(this.facts) || {}).then === undefined) {
      var temp = evaluator;
      evaluator = (function(orig) {
        return function(input) {
          var deferred = jQuery.Deferred();
          // convert to async
          if (orig(input)) {
            setTimeout(deferred.resolve, 0);
          } else {
            setTimeout(deferred.reject, 0);
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
      Object.defineProperty(this.events[name], '_auto_generated_', {
        value: true
      });
    }
    opts.events.push(name);
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
  RulesEngine.prototype.emit = function(event, isEvaluatingFlg) {
    if (isEvaluatingFlg) {
      if (this.events[event].bound._evaluation_event !== undefined) {
        this.events[event].bound._evaluation_event(this.facts);
        return true;
      }
      return false;
    }
    for (var name in this.events[event].bound) {
      this.events[event].bound[name](this.facts);
    }
    return false;
  };

  /** Binds a listener to an event. */
  RulesEngine.prototype.on = function(event, name, handler) {
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
      if (context.rulesMap[a].priority > context.rulesMap[b].priority) return 1;
      if (context.rulesMap[a].priority < context.rulesMap[b].priority) return -1;
      return 0;
    });
    var evaluateConditions = function(conditions) {
      var deferred = jQuery.Deferred();
      if (exit) return deferred.resolve();
      if (conditions === undefined) {
        return deferred.resolve();
      }
      var deferredArray = [];
      if (conditions.all !== undefined) {
        conditions.all.forEach(function(condition) {
          deferredArray.push(evaluateConditions(condition));
        });
        jQuery.when.apply(jQuery, deferredArray)
          .done(function() {
            deferred.resolve();
          }).fail(function() {
            deferred.reject();
          });
      } else if (conditions.any !== undefined) {
        conditions.any.forEach(function(condition) {
          deferredArray.push((function() {
            var deferred = jQuery.Deferred();
            evaluateConditions(condition)
              .done(function() {
                deferred.reject();
              })
              .fail(function() {
                deferred.resolve();
              });
            return deferred;
          })());
        });
        jQuery.when.apply(jQuery, deferredArray)
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
      var deferred = jQuery.Deferred();
      if (exit) return deferred.resolve();
      if (rule === undefined) return deferred.resolve();
      if (context.evaluatedRules[rule.name] === true) return deferred.resolve();
      if (context.evaluatedRules[rule.name] === false) return deferred.reject();
      if (context.evaluatedRules[rule.name] !== undefined && typeof context.evaluatedRules[rule.name].always === 'function') {
        context.evaluatedRules[rule.name]
          .done(function() {
            deferred.resolve();
          }).fail(function() {
            deferred.reject();
          });
        return deferred;
      }
      context.evaluatedRules[rule.name] = deferred;
      // check if conditions are satisfied first
      if (rule.conditions !== undefined) {
        evaluateConditions(rule.conditions)
          .done(function() {
            rule.test(context.facts)
              .done(function() {
                context.evaluatedRules[rule.name] = true;
                for (var i = 0; i < rule.events.length; i++) {
                  if (context.emit(rule.events[i], context.isEvaluatingFlg) === true) exit = true;
                }
                deferred.resolve();
              }).fail(function() {
                if (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined) exit = true;
                context.evaluatedRules[rule.name] = false;
                deferred.reject();
              });
          })
          .fail(function() {
            if (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined) exit = true;
            deferred.reject();
          });
      } else {
        rule.test(context.facts)
          .done(function() {
            context.evaluatedRules[rule.name] = true;
            for (var j = 0; j < rule.events.length; j++) {
              if (context.emit(rule.events[j], context.isEvaluatingFlg) === true) exit = true;
            }
            deferred.resolve();
          })
          .fail(function() {
            if (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined) exit = true;
            context.evaluatedRules[rule.name] = false;
            deferred.reject();
          });
      }

      return deferred;
    };
    if (Object.keys(context.rulesMap).length === 0) {
      return jQuery.Deferred().resolve();
    }
    var deferred = jQuery.Deferred();

    // chain promises
    var looper = function(index, deferredFn) {
      deferredFn(index).always(function() {
        if (index < context.rules.length) {
          looper(index + 1, deferredFn);
        } else {
          deferred.resolve();
        }
      });
    };
    looper(0, function(index) {
      return evaluateRule(context.rulesMap[context.rules[index]]);
    });
    return deferred;
  };

  /** Evaluates the rules engine against a set of facts without triggering any existing event listeners.
	    Used to test a listener against a set of facts.
	 */
  RulesEngine.prototype.evaluate = function(event, facts) {
    var deferred = jQuery.Deferred();
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
    this.evaluatedRules = {};
    this.on(event, '_evaluation_event', function(facts) {
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
      context.off(event, '_evaluation_event');
      context.facts = tempFacts;
      context.evaluatedRules = JSON.parse(tempEvaluatedRules);
      if (tempPriority !== undefined) {
        context.rulesMap[event].priority = tempPriority;
      }
      context.isEvaluatingFlg = false;
      deferred.reject();
    });
    return deferred;
  };

  return RulesEngine;
});
