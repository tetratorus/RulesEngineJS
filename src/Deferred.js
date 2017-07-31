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
  var promiseMethods = "done fail isResolved isRejected promise then always pipe".split( " " );
  var sliceDeferred = [].slice;
  var jQuery = {
    _Deferred: function() {
      var // callbacks list
        callbacks = [],
        // stored [ context , args ]
        fired,
        // to avoid firing when already doing so
        firing,
        // flag to know if the deferred has been cancelled
        cancelled,
        // the deferred itself
        deferred  = {

          // done( f1, f2, ...)
          done: function() {
            if ( !cancelled ) {
              var args = arguments,
                i,
                length,
                elem,
                type,
                _fired;
              if ( fired ) {
                _fired = fired;
                fired = 0;
              }
              for ( i = 0, length = args.length; i < length; i++ ) {
                elem = args[ i ];
                type = typeof elem;
                if (Array.isArray(elem)) type = 'array';
                if ( type === "array" ) {
                  deferred.done.apply( deferred, elem );
                } else if ( type === "function" ) {
                  callbacks.push( elem );
                }
              }
              if ( _fired ) {
                deferred.resolveWith( _fired[ 0 ], _fired[ 1 ] );
              }
            }
            return this;
          },

          // resolve with given context and args
          resolveWith: function( context, args ) {
            if ( !cancelled && !fired && !firing ) {
              // make sure args are available (#8421)
              args = args || [];
              firing = 1;
              try {
                while( callbacks[ 0 ] ) {
                  callbacks.shift().apply( context, args );
                }
              }
              finally {
                fired = [ context, args ];
                firing = 0;
              }
            }
            return this;
          },

          // resolve with this as context and given arguments
          resolve: function() {
            deferred.resolveWith( this, arguments );
            return this;
          },

          // Has this deferred been resolved?
          isResolved: function() {
            return !!( firing || fired );
          },

          // Cancel
          cancel: function() {
            cancelled = 1;
            callbacks = [];
            return this;
          }
        };

      return deferred;
    },

    // Full fledged deferred (two callbacks list)
    Deferred: function( func ) {
      var deferred = jQuery._Deferred(),
        failDeferred = jQuery._Deferred(),
        promise;
      // Add errorDeferred methods, then and promise
      var temp = {
        then: function( doneCallbacks, failCallbacks ) {
          deferred.done( doneCallbacks ).fail( failCallbacks );
          return this;
        },
        always: function() {
          return deferred.done.apply( deferred, arguments ).fail.apply( this, arguments );
        },
        fail: failDeferred.done,
        rejectWith: failDeferred.resolveWith,
        reject: failDeferred.resolve,
        isRejected: failDeferred.isResolved,
        pipe: function( fnDone, fnFail ) {
          return jQuery.Deferred(function( newDefer ) {
            var tempObj = {
              done: [ fnDone, "resolve" ],
              fail: [ fnFail, "reject" ]
            }
            var modifier = function( handler, data ) {
              var fn = data[ 0 ],
                action = data[ 1 ],
                returned;
              if ( typeof fn === 'function' ) {
                deferred[ handler ](function() {
                  returned = fn.apply( this, arguments );
                  if ( returned && typeof returned.promise === 'function' ) {
                    returned.promise().then( newDefer.resolve, newDefer.reject );
                  } else {
                    newDefer[ action ]( returned );
                  }
                });
              } else {
                deferred[ handler ]( newDefer[ action ] );
              }
            }
            for (var key in tempObj) {
              modifier(key, tempObj[key]);
            }
          }).promise();
        },
        // Get a promise for this deferred
        // If obj is provided, the promise aspect is added to the object
        promise: function( obj ) {
          if ( obj == null ) {
            if ( promise ) {
              return promise;
            }
            promise = obj = {};
          }
          var i = promiseMethods.length;
          while( i-- ) {
            obj[ promiseMethods[i] ] = deferred[ promiseMethods[i] ];
          }
          return obj;
        }
      };
      for (var key in temp) {
        deferred[key] = temp[key];
      }
      // Make sure only one callback list will be used
      deferred.done( failDeferred.cancel ).fail( deferred.cancel );
      // Unexpose cancel
      delete deferred.cancel;
      // Call given func if any
      if ( func ) {
        func.call( deferred, deferred );
      }
      return deferred;
    },

    // Deferred helper
    when: function( firstParam ) {
    var args = arguments,
      i = 0,
      length = args.length,
      count = length,
      deferred = length <= 1 && firstParam && typeof firstParam.promise === 'function' ?
        firstParam :
        jQuery.Deferred();
    function resolveFunc( i ) {
      return function( value ) {
        args[ i ] = arguments.length > 1 ? sliceDeferred.call( arguments, 0 ) : value;
        if ( !( --count ) ) {
          // Strange bug in FF4:
          // Values changed onto the arguments object sometimes end up as undefined values
          // outside the $.when method. Cloning the object into a fresh array solves the issue
          deferred.resolveWith( deferred, sliceDeferred.call( args, 0 ) );
        }
      };
    }
    if ( length > 1 ) {
      for( ; i < length; i++ ) {
        if ( args[ i ] && typeof args[ i ].promise === 'function' ) {
          args[ i ].promise().then( resolveFunc(i), deferred.reject );
        } else {
          --count;
        }
      }
      if ( !count ) {
        deferred.resolveWith( deferred, args );
      }
    } else if ( deferred !== firstParam ) {
      deferred.resolveWith( deferred, length ? [ firstParam ] : [] );
    }
    return deferred.promise();
  }
  }
  return jQuery;
});
