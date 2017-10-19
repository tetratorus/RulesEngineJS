(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RulesEngine = factory();
  }
}(this, function () {
  // fast method of yielding execution (instead of setTimeout)
  var soon = (function() {
    var fq = [];
    function callQueue() {
      while(fq.length) {
        fq[0]();
        fq.shift();
      }
    }
    var cqYield = (function() {
      if (typeof MutationObserver !== "undefined") {
        var dd = document.createElement("div");
        var mo = new MutationObserver(callQueue);
        mo.observe(dd, { attributes: true });
        return function(fn) { dd.setAttribute("a",0); };
      }
      if (typeof setImmediate !== "undefined") {
        return function() { setImmediate(callQueue); };
      }
      return function() { setTimeout(callQueue,0); };
    })();
    return function(fn) {
      fq.push(fn);
      if(fq.length == 1) cqYield();
    };
  })();
  var jQuery;
  try {
    // throw new Error('hi')
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
    } else {
      jQuery = $;
    }
  } catch (e) {
    console.error('jQuery not found.');
  }

  //***************************************************************//
  //  Rules Engine                                                 //
  //                                                               //
  //***************************************************************//

  /**
	 * Simple rules engine with support for event listeners.
	 * @constructor
	 * @param {promise} promise - accepts a promise library in place of jQuery.
	 */
  var RulesEngine = function(opts) {
    if (opts === undefined) {
      opts = {};
    }
    this.facts = opts.facts || {};
    this.rules = opts.rules || [];
    this.rulesMap = opts.rulesMap || {};
    this.evaluatedRules = opts.evaluatedRules || {};
    this.prevValues = opts.prevValues || {};
    this.prevToggle = opts.prevToggle || {};
    this.events = opts.events || {};
    this.queue = opts.queue || [];
    this.asyncTimeout = opts.asyncTimeout || 3000;
    this.engineTimeout = opts.engineTimeout || 10000;
    this.isEvaluatingFlg = opts.isEvaluatingFlg || false;
    this.isRunningFlg = opts.isRunningFlg || false;
    this.settings = opts.settings || {
      deterministic: false
    };
    this.promise = opts.promise;
    if (this.promise !== undefined) {
      jQuery = this.promise;
    } else if (jQuery.Deferred === undefined) {
      throw new Error ('No jQuery.Deferred or shim found.');
    } else {
      this.promise = jQuery;
    }
  };
  RulesEngine.prototype.constructor = RulesEngine;

  RulesEngine.prototype._log = function(method, logs) {
    if (typeof console === "undefined" || typeof console[method] !== 'function') return;
    console[method](logs);
  };

  RulesEngine.prototype._extend = function(facts, obj) {
    for (var key in obj) {
      facts[key] = obj[key];
    }
    return facts;
  }

  /** Replaces all the facts in the rules engine and triggers a run. */
  RulesEngine.prototype.updateFacts = function(facts) {
    var factsArray = Array.prototype.slice.call(arguments);
    if (this.isRunningFlg) { return this._enqueue(this.updateFacts, this, factsArray); };
    this.isRunningFlg = true;
    var context = this;
    var deferred = jQuery.Deferred();
    var facts = {};
    try {
      factsArray.map(function(item) {
        if (typeof item !== 'object') throw new Error('updateFacts() only accepts objects as arguments.');
        facts = context._extend(facts, item);
      });
      var updatedKeys = [];
      for (var key in facts) {
        context.facts[key] = facts[key];
        updatedKeys.push(key);
      }
      for (var k in context.facts) {
        if (updatedKeys.indexOf(k) === -1) {
          delete context.facts[k];
        } else {
          context.facts[k] = context._deepCopy(context.facts[k]);
        }
      }
    } catch (e) {
      this._log('error', e);
      deferred.resolve();
      context._dequeue();
      return deferred;
    }
    this._run('updateFacts').always(function() {
      deferred.resolve();
      context._dequeue();
    });
    return deferred;
  };

  /** Returns a deep copy of an object (can be overriden). */
  RulesEngine.prototype._deepCopy = function(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      this._log(e);
      return obj;
    }
  };

  /** Get facts via dot accessors.
      Facts should be immutable. Update them using updateFacts().
   */
  RulesEngine.prototype.getFacts = function(accessor) {
    var res = this.facts;
    if (accessor === undefined || typeof accessor !== 'string') return res;
    var arr = accessor.split('.');
    for (var i = 0; i < arr.length; i++) {
      res = res[arr[i]];
      if (res === undefined) return undefined;
    }
    return res;
  };

  /** Helper function to get deep copy of facts. */
  RulesEngine.prototype.copyFacts = function(accessor) {
    return this._deepCopy(this.getFacts(accessor));
  }

  /** Adds a rule, accepts three arguments:
       name - name of the rule,
       evaluator - a function which takes facts and outputs a boolean or a jQuery Deferred object
       (addRule will automatically wrap all boolean functions with jQuery.Deferred)
       opts - options for conditions, priority, and events (to be triggered)
    */
  RulesEngine.prototype.addRule = function(name, evaluator, opts) {
    if (this.settings.deterministic) {
      evaluator = (new Function('return ' + evaluator))();
    }
    if (typeof name !== 'string') return;
    if (this.rulesMap[name] !== undefined) {
      this._log('warn', 'Rule has already been defined. Removing previous rule.');
      this.removeRule(name);
    }
    var wrappedEvaluator;
    var context = this;
    if (typeof evaluator !== 'function') {
      wrappedEvaluator = function() {
        var deferred = jQuery.Deferred();
        if (evaluator || evaluator === undefined) {
          soon(deferred.resolve);
        } else {
          soon(deferred.reject);
        }
        return deferred;
      };
    } else if (
        ((function(){
          try {
            return evaluator.apply(
              this,
              Array.prototype.slice.call(
                arguments,
                arguments.length - evaluator.length,
                arguments.length
              )
            );
          } catch(e) {
            context._log('error', e);
            return {};
          }
        })(this.facts) || {}).done === undefined
      ) {
      wrappedEvaluator = (function(evaluator) {
        return function() {
          var deferred = jQuery.Deferred();
          // convert to async
          try {
            if (evaluator.apply(
              this,
              Array.prototype.slice.call(
                arguments,
                arguments.length - evaluator.length,
                arguments.length
              )
            )) {
              soon(deferred.resolve);
            } else {
              soon(deferred.reject);
            }
          } catch (e) {
            context._log('error', e);
            soon(function() {
              if (deferred.state() === 'pending') deferred.reject();
            });
          }
          return deferred;
        };
      })(evaluator);
    } else {
      wrappedEvaluator = function() {
        var deferred = jQuery.Deferred();
        try {
          evaluator.apply(
            this,
            Array.prototype.slice.call(
              arguments,
              arguments.length - evaluator.length,
              arguments.length
            )
          )
          .done(function() {
            deferred.resolve();
          })
          .fail(function() {
            deferred.reject();
          });
          setTimeout(function() {
            if (deferred.state() === 'pending') {
              deferred.reject();
              context._log('error', 'Timed out for evaluation of function: ' + name);
            }
          }, context.asyncTimeout);
          return deferred;
        } catch (e) {
          context._log('error', e);
          soon(function() {
            if (deferred.state() === 'pending') deferred.reject();
          });
          return deferred;
        }
      };
    }
    if (Array.isArray(opts) || typeof opts !== 'object') {
      opts = {};
    }
    if (opts.priority === undefined) {
      opts.priority = 9;
    }
    if (opts.toggle === undefined) {
      opts.toggle = false;
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
      test: wrappedEvaluator,
      priority: opts.priority,
      conditions: opts.conditions, // TODO: check for circular dependencies
      toggle: opts.toggle
    };
    this.prevToggle[name] = new Date();
    delete this.evaluatedRules[name];
    delete this.prevValues[name];
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
    delete this.evaluatedRules[name];
    delete this.prevValues[name];
    delete this.prevToggle[name];
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
      if (this.events[event] && this.events[event].bound._evaluation_event !== undefined) {
        try {
          this.events[event].bound._evaluation_event(this.facts);
        } catch (e) {
          this._log('error', e);
        }
        return true;
      }
      return false;
    }
    for (var name in this.events[event].bound) {
      try {
        this.events[event].bound[name](this.facts);
      } catch (e) {
        this._log('error', e);
      }
    }
    return false;
  };

  /** Binds a listener to an event. */
  RulesEngine.prototype.on = function(event, name, handler) {
    if (handler === undefined && typeof name === 'function') {
      handler = name;
      name = event;
    }
    try {
      this.events[event].bound[name] = handler;
    } catch (e) {
      this._log('error', e);
    }
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

  /** Wrapper around _run method. */
  RulesEngine.prototype.run = function() {
    if (this.isRunningFlg) {
      return this._enqueue(this.run, this, []);
    } else {
      var deferred = jQuery.Deferred();
      var context = this;
      this.isRunningFlg = true;
      this._run('run').always(function() {
        deferred.resolve();
        context._dequeue();
      });
      return deferred;
    }
  };

  /** Runs the rules engine and emits events accordingly. */
  RulesEngine.prototype._run = function(caller) {
    var exit = false;
    var context = this;
    var ruleArgs = [context, context.facts];
    context.prevValues = {};
    for (var rule in context.evaluatedRules) {
      context.prevValues[rule] = context.evaluatedRules[rule];
    }
    if (caller !== 'run') context.evaluatedRules = {};
    context.rules.sort(function(a, b) {
      if (context.rulesMap[a].priority > context.rulesMap[b].priority) return 1;
      if (context.rulesMap[a].priority < context.rulesMap[b].priority) return -1;
      if (context.prevToggle[a] < context.prevToggle[b]) return 1;
      if (context.prevToggle[a] > context.prevToggle[b]) return -1;
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

      var test = function(rule, context, deferred) {
        rule.test.apply(context, ruleArgs)
          .done(function() {
            context.evaluatedRules[rule.name] = true;
            if (context.prevValues[rule.name] !== true) context.prevToggle[rule.name] = new Date();
            if (!rule.toggle || context.prevValues[rule.name] !== true ||
           (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined)) {
              for (var i = 0; i < rule.events.length; i++) {
                if (context.emit(rule.events[i], context.isEvaluatingFlg) === true) exit = true;
              }
            }
            deferred.resolve();
          }).fail(function() {
            context.evaluatedRules[rule.name] = false;
            if (context.prevValues[rule.name] !== false) context.prevToggle[rule.name] = new Date();
            if (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined) exit = true;
            deferred.reject();
          });
      };

      // check conditions
      if (rule.conditions !== undefined) {
        evaluateConditions(rule.conditions)
          .done(function() {
            test(rule, context, deferred);
          })
          .fail(function() {
            context.evaluatedRules[rule.name] = false;
            if (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined) exit = true;
            deferred.reject();
          });
      } else {
        test(rule, context, deferred);
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
        if (index < context.rules.length && !exit) {
          looper(index + 1, deferredFn);
        } else {
          deferred.resolve();
        }
      });
    };
    looper(0, function(index) {
      return evaluateRule(context.rulesMap[context.rules[index]]);
    });
    setTimeout(function() {
      if (deferred.state() === 'pending') {
        context._log('error', 'Rules engine timed out.');
        context.evaluatedRules = {};
        deferred.reject();
      }
    }, this.engineTimeout);
    return deferred;
  };

  /** Evaluates the rules engine against a set of facts without triggering any existing event listeners.
       Used to test a listener against a set of facts.
    */
  RulesEngine.prototype.evaluate = function(event, facts) {
    if (this.isRunningFlg) { return this._enqueue(this.evaluate, this, [event, facts]); };
    this.isRunningFlg = true;
    this.isEvaluatingFlg = true;
    var deferred = jQuery.Deferred();
    var tempFacts = this.facts;
    var tempEvaluatedRules = {};
    for (var rule in this.evaluatedRules) {
      tempEvaluatedRules[rule] = this.evaluatedRules[rule];
    }
    var tempPrevValues = {};
    for (var rule in this.prevValues) {
      tempPrevValues[rule] = this.prevValues[rule];
    }
    var tempPrevToggle = {};
    for (var rule in this.prevToggle) {
      tempPrevToggle[rule] = this.prevToggle[rule];
    }
    var tempPriority;
    var context = this;
    if (facts !== undefined) {
      this.facts = facts;
    }
    if (this.rulesMap[event] && this.events[event]._auto_generated_ === true) {
      tempPriority = this.rulesMap[event].priority;
      this.rulesMap[event].priority = -Infinity;
    }
    this.evaluatedRules = {};
    this.prevValues = {};
    this.on(event, '_evaluation_event', function(facts) {
      deferred.resolve();
    });
    this._run('evaluate').always(function() {
      context.off(event, '_evaluation_event');
      context.facts = tempFacts;
      context.evaluatedRules = tempEvaluatedRules;
      context.prevValues = tempPrevValues;
      context.prevToggle = tempPrevToggle;
      if (tempPriority !== undefined) {
        context.rulesMap[event].priority = tempPriority;
      }
      context.isEvaluatingFlg = false;
      if (deferred.state() === 'pending') {
        deferred.reject();
      }
      context._dequeue();
    });
    return deferred;
  };

  RulesEngine.prototype._enqueue = function(fn, context, argsArr) {
    var deferred = jQuery.Deferred();
    this.queue.push([fn, context, argsArr, deferred]);
    return deferred;
  };

  RulesEngine.prototype._dequeue = function() {
    this.isRunningFlg = false;
    if (this.queue.length === 0) return;
    var next = this.queue.shift();
    next[0].apply(next[1], next[2])
      .done(function() {
        next[3].resolve();
      })
      .fail(function() {
        next[3].reject();
      });
  };

  return RulesEngine;
}));
