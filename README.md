# RulesEngineJS
### What is a rules engine?
A rules engine decouples the workflow logic from other components. This is done by defining the rules once, and having components listen for events triggered by a rule. This reduces repeated code in components and makes it easier to update existing rules. Rules engines also reduce repeated code in the rules logic, by allowing rules to be composed and conditioned on other rules.

### How does it work?
The rules engine has three parts: facts, rules, and events.

When facts are updated in the rules engine, its rules are evaluated. If a rule passes (resolves or evaluates to true), it triggers any events that has been defined in that rule. Any listeners which are listening for that event will then be triggered.

### Why should I use this?
- Supports async rules (using jQuery.Deferred)
- Supports rule priorities
- Supports event listeners
- Supports nested conditions (all, any)
- Supports negative conditions (!)
- Small (5KB minified)
- Efficient (caching, early exit)
- Only depends on jQuery

If you are a front-end developer in need of a lightweight rules engine, this is it.
```html
<script src="rulesengine.min.js"></script>
```

### How do I use it?
1.  Define a rules engine.
```js
var RE = new RulesEngine();
```
2.  Add rules.
```js
RE.addRules([
    ['status_is_active', function(facts) {
        return (facts.entity||{}).statusCode === 1
    }],
    ['status_is_approved', function(facts) {
        return (facts.entity||{}).statusCode === 2
    }],
    ['not_approved_or_active', null, {
        conditions: {
            all: ['!status_is_approved', '!status_is_active']
        },
        events: 'is_editable'
    }]
])
```
3.  Add listeners.
```js
RE.on('is_editable', 'disable_next_button', function() {
    $('.blue-button.next-button').addClass('disabled');
});
```
4.  Update facts.
```js
RE.updateFacts($.extend(RE.facts, {entity: this.entity}))
```

### What methods are available?
```js
RE.updateFacts(facts) // returns $.Deferred()
RE.addRule(name, evaluator, options)
RE.addRules([[name, evaluator, options], [name, evaluator, options] ...]
RE.deleteRule(name)
RE.addEvent(name)
RE.addEvents([name, name ...])
RE.emit(event)
RE.on(event, name, handler)
RE.run() // returns $.Deferred()

RE.evaluate(facts, event) // returns $.Deferred()
// Evaluates against a set of facts to see if an event is triggered
// Triggers no other events and does not modify state (idempotent)

```
