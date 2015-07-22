// Object.assign
if (!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function(target, firstSource) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object');
      }

      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if (nextSource === undefined || nextSource === null) {
          continue;
        }

        var keysArray = Object.keys(Object(nextSource));
        for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex];
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if (desc !== undefined && desc.enumerable) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
      return to;
    }
  });
}

// Array.prototype.includes
[].includes||(Array.prototype.includes=function(a){"use strict";var b=Object(this),c=parseInt(b.length)||0;if(0===c)return!1;var e,d=parseInt(arguments[1])||0;d>=0?e=d:(e=c+d,0>e&&(e=0));for(var f;c>e;){if(f=b[e],a===f||a!==a&&f!==f)return!0;e++}return!1});
