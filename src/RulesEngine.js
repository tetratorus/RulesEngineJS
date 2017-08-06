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
  try {
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
  } catch (e) {
      jQuery = !function(e,n){if("function"==typeof define&&define.amd)define(n);else{var r=n();"object"!=typeof module?e[r.name]=r:module.exports=r}}(this,function(){var e="done fail isResolved isRejected promise then always pipe".split(" "),n=[].slice,r={_Deferred:function(){var e,n,r,t=[],i={done:function(){if(!r){var n,o,f,l,s,c=arguments;for(e&&(s=e,e=0),n=0,o=c.length;n<o;n++)l=typeof(f=c[n]),Array.isArray(f)&&(l="array"),"array"===l?i.done.apply(i,f):"function"===l&&t.push(f);s&&i.resolveWith(s[0],s[1])}return this},resolveWith:function(i,o){if(!r&&!e&&!n){o=o||[],n=1;try{for(;t[0];)t.shift().apply(i,o)}finally{e=[i,o],n=0}}return this},resolve:function(){return i.resolveWith(this,arguments),this},isResolved:function(){return!(!n&&!e)},cancel:function(){return r=1,t=[],this}};return i},Deferred:function(n){var t,i=r._Deferred(),o=r._Deferred(),f={then:function(e,n){return i.done(e).fail(n),this},always:function(){return i.done.apply(i,arguments).fail.apply(this,arguments)},fail:o.done,rejectWith:o.resolveWith,reject:o.resolve,isRejected:o.isResolved,pipe:function(e,n){return r.Deferred(function(r){var t={done:[e,"resolve"],fail:[n,"reject"]};for(var o in t)!function(e,n){var t,o=n[0],f=n[1];"function"==typeof o?i[e](function(){(t=o.apply(this,arguments))&&"function"==typeof t.promise?t.promise().then(r.resolve,r.reject):r[f](t)}):i[e](r[f])}(o,t[o])}).promise()},promise:function(n){if(null==n){if(t)return t;t=n={}}for(var r=e.length;r--;)n[e[r]]=i[e[r]];return n}};for(var l in f)i[l]=f[l];return i.done(o.cancel).fail(i.cancel),delete i.cancel,n&&n.call(i,i),i},when:function(e){var t=arguments,i=0,o=t.length,f=o,l=o<=1&&e&&"function"==typeof e.promise?e:r.Deferred();if(o>1){for(;i<o;i++)t[i]&&"function"==typeof t[i].promise?t[i].promise().then(function(e){return function(r){t[e]=arguments.length>1?n.call(arguments,0):r,--f||l.resolveWith(l,n.call(t,0))}}(i),l.reject):--f;f||l.resolveWith(l,t)}else l!==e&&l.resolveWith(l,o?[e]:[]);return l.promise()}};return r});
  }

  //***************************************************************//
  //  Rules Engine                                                 //
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
    this.prevValues = {};
    this.events = {};
    this.queue = [];
    this.asyncTimeout = 3000;
    this.engineTimeout = 10000;
    this.isEvaluatingFlg = false;
    this.isRunningFlg = false;
    if (Promise !== undefined) {
      jQuery = Promise;
    } else if (jQuery.Deferred === undefined) {
      throw new Error ('No jQuery.Deferred or shim found.');
    }
  };
  RulesEngine.prototype.constructor = RulesEngine;

  RulesEngine.prototype._log = function(method, logs) {
    if (typeof console === "undefined" || typeof console[method] !== 'function') return;
    console[method](logs);
  }

  /** Replaces all the facts in the rules engine and triggers a run. */
  RulesEngine.prototype.updateFacts = function(facts) {
    if (this.isRunningFlg) { return this._enqueue(this.updateFacts, this, [facts]); };
    this.isRunningFlg = true;
    var context = this;
    var deferred = jQuery.Deferred();
    if (typeof facts === 'object') {
      this.facts = facts;
      this._run().always(function() {
        deferred.resolve();
        context._dequeue();
      });
      return deferred;
    }
  };

  /** Returns a deep copy of an object (can be overriden). */
  RulesEngine.prototype._deepCopy = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  RulesEngine.prototype.getFacts = function(accessor) {
    var res = this._deepCopy(this.facts);
    if (accessor === undefined || typeof accessor !== 'string') return res;
    var arr = accessor.split('.');
    for (var i = 0; i < arr.length; i++) {
      res = res[arr[i]];
      if (res === undefined) return undefined;
    }
    return res;
  };

  /** Adds a rule, accepts three arguments:
	    name - name of the rule,
	    evaluator - a function which takes facts and outputs a boolean or a jQuery Deferred object
	    (addRule will automatically wrap all boolean functions with jQuery.Deferred)
	    opts - options for conditions, priority, and events (to be triggered)
	 */
  RulesEngine.prototype.addRule = function(name, evaluator, opts) {
    if (typeof name !== 'string') return;
    var wrappedEvaluator;
    var context = this;
    if (typeof evaluator !== 'function') {
      wrappedEvaluator = function() {
        var deferred = jQuery.Deferred();
        setTimeout(deferred.resolve, 0);
        return deferred;
      };
    } else if ((evaluator(this.facts) || {}).then === undefined) {
      wrappedEvaluator = (function(evaluator) {
        return function(input) {
          var deferred = jQuery.Deferred();
          // convert to async
          try {
            if (evaluator(input)) {
              setTimeout(deferred.resolve, 0);
            } else {
              setTimeout(deferred.reject, 0);
            }
            return deferred;
          } catch (e) {
            context._log('error', e);
            setTimeout(function() {
              if (deferred.state() === 'pending') deferred.reject();
            }, 0);
            return deferred;
          }
        };
      })(evaluator);
    } else {
      wrappedEvaluator = function(input) {
        var deferred = jQuery.Deferred();
        try {
          evaluator(input)
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
          setTimeout(function() {
            if (deferred.state() === 'pending') deferred.reject();
          }, 0);
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
      opts.toggle = true;
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

  /** Wrapper around _run method. */
  RulesEngine.prototype.run = function() {
    if (this.isRunningFlg) {
      return this._enqueue(this.run, this, []);
    } else {
      var deferred = jQuery.Deferred();
      var context = this;
      this.isRunningFlg = true;
      this._run().always(function() {
        deferred.resolve();
        context._dequeue();
      });
      return deferred;
    }
  };

  /** Runs the rules engine and emits events accordingly. */
  RulesEngine.prototype._run = function() {
    var exit = false;
    var context = this;
    context.prevValues = JSON.parse(JSON.stringify(context.evaluatedRules));
    context.evaluatedRules = {};
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

      var test = function(rule, context, deferred) {
        rule.test(context.facts)
        .done(function() {
          context.evaluatedRules[rule.name] = true;
          if (!rule.toggle || context.prevValues[rule.name] !== true ||
          (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined)) {
            for (var i = 0; i < rule.events.length; i++) {
              if (context.emit(rule.events[i], context.isEvaluatingFlg) === true) exit = true;
            }
          }
          deferred.resolve();
        }).fail(function() {
          context.evaluatedRules[rule.name] = false;
          if (((context.events[rule.name]||{}).bound||{})._evaluation_event !== undefined) exit = true;
          deferred.reject();
        });
      }

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
    setTimeout(function() {
      if (deferred.state() === 'pending') {
        context._log('error', 'Rules engine timed out.');
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
    var tempEvaluatedRules = JSON.stringify(this.evaluatedRules);
    var tempPrevValues = JSON.stringify(this.prevValues);
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
      context.evaluatedRules = JSON.parse(tempEvaluatedRules);
      context.prevValues = JSON.parse(tempPrevValues);
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
});
