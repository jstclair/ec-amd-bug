(function(e){if("function"==typeof bootstrap)bootstrap("editablecell",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeEditableCell=e}else"undefined"!=typeof window?window.editableCell=e():global.editableCell=e()})(function(){var define,ses,bootstrap,module,exports;
return (function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
var koBindingHandlers = require('./ko');

exports.selectCell = function (cell) {
    var table = cell.parentNode.parentNode.parentNode,
        selection = table._cellSelection;

    selection.setRange(cell, cell);
};

exports.getTableSelection = function (table) {
    var selection = table._cellSelection;

    return selection;
};

exports.setCellValue = function (cell, value) {
    var table = cell.parentNode.parentNode.parentNode,
        selection = table._cellSelection;

    selection.updateCellValue(cell, value);
};
},{"./ko":2}],2:[function(require,module,exports){
var polyfill = require('../polyfill');

// Knockout binding handlers
var bindingHandlers = {
    editableCell: require('./editableCellBinding'),
    editableCellSelection: require('./editableCellSelectionBinding'),
    editableCellViewport: require('./editableCellViewportBinding'),
};

// Register Knockout binding handlers if Knockout is loaded
if (typeof ko !== 'undefined') {
    for (var bindingHandler in bindingHandlers) {
        ko.bindingHandlers[bindingHandler] = bindingHandlers[bindingHandler];
    }
}
},{"../polyfill":3,"./editableCellBinding":4,"./editableCellSelectionBinding":5,"./editableCellViewportBinding":6}],3:[function(require,module,exports){
function forEach (list, f) {
  var i;

  for (i = 0; i < list.length; ++i) {
    f(list[i], i);
  }
}

forEach([Array, window.NodeList, window.HTMLCollection], extend);

function extend (object) {
  var prototype = object && object.prototype;

  if (!prototype) {
    return;
  }

  prototype.forEach = prototype.forEach || function (f) {
    forEach(this, f);
  };

  prototype.filter = prototype.filter || function (f) {
    var result = [];

    this.forEach(function (element) {
      if (f(element, result.length)) {
        result.push(element);
      }
    });

    return result;
  };

  prototype.map = prototype.map || function (f) {
    var result = [];

    this.forEach(function (element) {
      result.push(f(element, result.length));
    });

    return result;
  };
}
},{}],4:[function(require,module,exports){
var utils = require('./utils');

var editableCell = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var table = $(element).parents('table')[0],
            selection = utils.initializeSelection(table),
            valueBindingName = 'editableCell';

        selection.registerCell(element);

        if (allBindingsAccessor().cellValue) {
            valueBindingName = 'cellValue';
            valueAccessor = function () { return allBindingsAccessor().cellValue; };
        }

        element._cellTemplated = element.innerHTML.trim() !== '';
        element._cellValue = valueAccessor;
        element._cellText = function () { return allBindingsAccessor().cellText || this._cellValue(); };
        element._cellReadOnly = function () { return ko.utils.unwrapObservable(allBindingsAccessor().cellReadOnly); };
        element._cellValueUpdater = function (newValue) {
            utils.updateBindingValue(valueBindingName, this._cellValue, allBindingsAccessor, newValue);

            if (!ko.isObservable(this._cellValue())) {
                ko.bindingHandlers.editableCell.update(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
            }
        };

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            selection.unregisterCell(element);

            element._cellValue = null;
            element._cellText = null;
            element._cellReadOnly = null;
            element._cellValueUpdater = null;
        });

        if (element._cellTemplated) {
            ko.utils.domData.set(element, 'editableCellTemplate', {});
            return { 'controlsDescendantBindings': true };
        }
    },
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        if (element._cellTemplated) {
            var template = ko.utils.domData.get(element, 'editableCellTemplate');

            if (!template.savedNodes) {
                template.savedNodes = utils.cloneNodes(ko.virtualElements.childNodes(element), true /* shouldCleanNodes */);
            }
            else {
                ko.virtualElements.setDomNodeChildren(element, utils.cloneNodes(template.savedNodes));
            }

            ko.applyBindingsToDescendants(bindingContext.createChildContext(ko.utils.unwrapObservable(valueAccessor())), element);
        }
        else {
            element.textContent = ko.utils.unwrapObservable(element._cellText());
        }
    }
};

module.exports = editableCell;
},{"./utils":7}],5:[function(require,module,exports){
var utils = require('./utils');
var editableCellSelection = {
    _selectionMappings: [],

    init: function (element, valueAccessor, allBindingsAccessor) {
        if (element.tagName !== 'TABLE') {
            throw new Error('editableCellSelection binding can only be applied to tables');
        }

        var table = element,
            selection = utils.initializeSelection(table);

        // Update supplied observable array when selection range changes
        selection.on('change', rangeChanged);

        function rangeChanged (newSelection) {
            newSelection = ko.utils.arrayMap(newSelection, function (cell) {
                return {
                    cell: cell,
                    value: cell._cellValue(),
                    text: cell._cellText()
                };
            });

            utils.updateBindingValue('editableCellSelection', valueAccessor, allBindingsAccessor, newSelection);
        }

        // Keep track of selections
        ko.bindingHandlers.editableCellSelection._selectionMappings.push([valueAccessor, table]);

        // Perform clean-up when table is removed from DOM
        ko.utils.domNodeDisposal.addDisposeCallback(table, function () {
            // Remove selection from list
            var selectionIndex = ko.utils.arrayFirst(ko.bindingHandlers.editableCellSelection._selectionMappings, function (tuple) {
                return tuple[0] === valueAccessor;
            });
            ko.bindingHandlers.editableCellSelection._selectionMappings.splice(selectionIndex, 1);

            // Remove event listener
            selection.removeListener('change', rangeChanged);
        });
    },
    update: function (element, valueAccessor, allBindingsAccessor) {
        var table = element,
            selection = table._cellSelection,
            newSelection = ko.utils.unwrapObservable(valueAccessor()) || [];

        // Empty selection, so simply clear it out
        if (newSelection.length === 0) {
            selection.clear();
            return;
        }

        var start = newSelection[0],
            end = newSelection[newSelection.length - 1];

        var isDirectUpdate = start.tagName === 'TD' || start.tagName === 'TH';

        // Notification of changed selection, either after programmatic  
        // update or after changing current selection in user interface
        if (!isDirectUpdate) {
            start = start.cell;
            end = end.cell;
        }

        // Make sure selected cells belongs to current table, or else hide selection
        var parentRowHidden = !start.parentNode;
        var belongingToOtherTable = start.parentNode && start.parentNode.parentNode.parentNode !== table;

        if (parentRowHidden || belongingToOtherTable) {
            // Selection cannot be cleared, since that will affect selection in other table
            selection.view.hide();
            return;
        }

        // Programmatic update of selection, i.e. selection([startCell, endCell]);
        if (isDirectUpdate) {
            selection.setRange(start, end);
        }
    }
};

module.exports = editableCellSelection;
},{"./utils":7}],6:[function(require,module,exports){
var utils = require('./utils');
var editableCellViewport = {
    init: function (element) {
        if (element.tagName !== 'TABLE') {
            throw new Error('editableCellViewport binding can only be applied to tables');
        }

        utils.initializeSelection(element);
    },
    update: function (element, valueAccessor) {
        var table = element,
            selection = table._cellSelection,
            viewport = ko.utils.unwrapObservable(valueAccessor());

        selection.setViewport(viewport);
    }
};

module.exports = editableCellViewport;
},{"./utils":7}],7:[function(require,module,exports){
var Selection = require('../selection');
module.exports = {
    initializeSelection: initializeSelection,
    updateBindingValue: updateBindingValue,
    cloneNodes: cloneNodes
};

function initializeSelection (table) {
    var selection = table._cellSelection;

    if (selection === undefined) {
        table._cellSelection = selection = new Selection(table, ko.bindingHandlers.editableCellSelection._selectionMappings);

        ko.utils.domNodeDisposal.addDisposeCallback(table, function () {
            table._cellSelection.destroy();
        });
    }

    return selection;
}

// `updateBindingValue` is a helper function borrowing private binding update functionality
// from Knockout.js for supporting updating of both observables and non-observables.
function updateBindingValue (bindingName, valueAccessor, allBindingsAccessor, newValue) {
    if (ko.isWriteableObservable(valueAccessor())) {
        valueAccessor()(newValue);
        return;
    }

    var propertyWriters = allBindingsAccessor()._ko_property_writers;
    if (propertyWriters && propertyWriters[bindingName]) {
        propertyWriters[bindingName](newValue);
    }

    if (!ko.isObservable(valueAccessor())) {
        allBindingsAccessor()[bindingName] = newValue;
    }
}

// Borrowed from Knockout.js
function cloneNodes (nodesArray, shouldCleanNodes) {
    for (var i = 0, j = nodesArray.length, newNodesArray = []; i < j; i++) {
        var clonedNode = nodesArray[i].cloneNode(true);
        newNodesArray.push(shouldCleanNodes ? ko.cleanNode(clonedNode) : clonedNode);
    }
    return newNodesArray;
}
},{"../selection":8}],9:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],10:[function(require,module,exports){
(function(process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    this._events = {};
    return this;
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

})(require("__browserify_process"))
},{"__browserify_process":9}],8:[function(require,module,exports){
var SelectionView = require('./selectionView'),
    SelectionRange = require('./selectionRange'),
    EventEmitter = require('events').EventEmitter,
    polyfill = require('./polyfill');

module.exports = Selection;

Selection.prototype = new EventEmitter();

function Selection (table, selectionMappings) {
    var self = this,
        range = new SelectionRange(getRowByIndex, getCellByIndex, cellIsSelectable, cellIsVisible);

    self.view = new SelectionView(table, self);

    range.on('change', function (newSelection) {
        self.emit('change', newSelection);
        if (newSelection.length === 0) {
            self.view.hide();
            return;
        }
        self.view.update(newSelection[0], newSelection[newSelection.length - 1]);
    });

    self.setRange = function (start, end) {
        range.setStart(start);
        range.setEnd(end);
    };

    self.getRange = function () {
        return {
            start: range.start,
            end: range.end
        };
    };

    self.clear = range.clear;

    self.getCells = function () {
        return range.selection;
    };

    self.destroy = function () {
        self.view.destroy();
        range.destroy();
        self.removeAllListeners();

        table._cellSelection = null;
    };

    self.focus = self.view.focus;

    self.setViewport = function (viewport) {
        self.view.viewport = viewport;
    };

    self.registerCell = function (cell) {
        cell.addEventListener("mousedown", self.onMouseDown);
        cell.addEventListener("mouseover", self.onCellMouseOver);
        cell.addEventListener("focus", self.onCellFocus);
    };

    self.unregisterCell = function (cell) {
        cell.removeEventListener('mousedown', self.onMouseDown);
        cell.removeEventListener('mouseover', self.onCellMouseOver);
        cell.removeEventListener('focus', self.onCellFocus);
    };

    self.onMouseDown = function (event) {
        if (self.isEditingCell()) {
            return;
        }

        self.onCellMouseDown(this, event.shiftKey);
        event.preventDefault();
    };

    self.updateCellValue = function (cell, newValue) {
        var value;

        if (!cellIsEditable(cell)) {
            return undefined;
        }

        if (newValue === undefined) {
            value = self.view.inputElement.value;
        }
        else {
            value = newValue;
        }

        cell._cellValueUpdater(value);

        return value;
    };

    self.startEditing = function () {
        self.startEditingCell(range.start);
    };

    self.startLockedEditing = function () {
        self.startEditingCell(range.start, true);
    };

    self.startEditingCell = function (cell, isLockedToCell) {
        if (!cellIsEditable(cell)) {
            return;
        }

        if (range.start !== cell) {
            range.setStart(cell);
        }

        self.view.inputElement.style.top = table.offsetTop + cell.offsetTop + 'px';
        self.view.inputElement.style.left = table.offsetLeft + cell.offsetLeft + 'px';
        self.view.inputElement.style.width = cell.offsetWidth + 'px';
        self.view.inputElement.style.height = cell.offsetHeight + 'px';
        self.view.inputElement.value = ko.utils.unwrapObservable(cell._cellValue());
        self.view.inputElement.style.display = 'block';
        self.view.inputElement.focus();
        self.view.isLockedToCell = isLockedToCell;

        document.execCommand('selectAll', false, null);
        self.view.element.style.pointerEvents = 'none';
    };
    self.isEditingCell = function (cell) {
        return self.view.inputElement.style.display === 'block';
    };
    self.cancelEditingCell = function (cell) {
        self.view.inputElement.style.display = 'none';
        self.view.element.style.pointerEvents = 'inherit';
    };
    self.endEditingCell = function (cell) {
        self.view.inputElement.style.display = 'none';
        self.view.element.style.pointerEvents = 'inherit';
        return self.updateCellValue(cell);
    };
    function cellIsSelectable(cell) {
        return cell._cellValue !== undefined;
    }
    function cellIsEditable(cell) {
        return cell._cellReadOnly() !== true;
    }
    function cellIsVisible (cell) {
        return cell && cell.offsetHeight !== 0;
    }
    function getRowByIndex (index, originTable) {
        var targetTable = originTable || table;

        // Check if we're moving out of table
        if (index === -1 || index === targetTable.rows.length) {
            // Find selection mapping for table
            var selectionMapping = getSelectionMappingForTable(targetTable);

            // We can only proceed check if mapping exists, i.e. that editableCellSelection binding is used
            if (selectionMapping) {
                // Find all selection mappings for selection, excluding the one for the current table
                var tableMappings = selectionMappings.filter(function (tuple) {
                    return tuple[0]() === selectionMapping[0]() && tuple[1] !== targetTable;
                });

                var tables = tableMappings.map(function (tuple) { return tuple[1]; });
                var beforeTables = tables.filter(function (t) { return t.offsetTop + t.offsetHeight <= table.offsetTop; });
                var afterTables = tables.filter(function (t) { return t.offsetTop >= table.offsetTop + table.offsetHeight; });

                // Moving upwards
                if (index === -1 && beforeTables.length) {
                    targetTable = beforeTables[beforeTables.length - 1];
                    index = targetTable.rows.length - 1;
                }
                // Moving downwards
                else if (index === targetTable.rows.length && afterTables.length) {
                    targetTable = afterTables[0];
                    index = 0;
                }
            }
        }
        
        return targetTable.rows[index];
    }
    function getCellByIndex (row, index) {
        var i, colSpanSum = 0;

        for (i = 0; i < row.children.length; i++) {
            if (index < colSpanSum) {
                return row.children[i - 1];
            }
            if (index === colSpanSum) {
                return row.children[i];
            }

            colSpanSum += row.children[i].colSpan;
        }
    }
    function getSelectionMappingForTable (table) {
        return selectionMappings.filter(function (tuple) {
                return tuple[1] === table;
        })[0];
    }
    function updateSelectionMapping(newStartOrEnd) {
        var newTable = newStartOrEnd && newStartOrEnd.parentNode && newStartOrEnd.parentNode.parentNode.parentNode;

        if (newTable !== table) {
            var mapping = getSelectionMappingForTable(newTable);
            if (mapping) {
                var selection = mapping[0]();
                selection([newStartOrEnd]);
            }
        }
    }
    self.onCellMouseDown = function (cell, shiftKey) {
        if (shiftKey) {
            range.setEnd(cell);
        }
        else {
            range.setStart(cell);
        }

        self.view.beginDrag();
        event.preventDefault();
    };
    self.onCellMouseOver = function (event) {
        var cell = event.target;

        if (!self.view.isDragging) {
            return;
        }

        while (cell && !(cell.tagName === 'TD' || cell.tagName === 'TH')) {
            cell = cell.parentNode;
        }

        if (cell && cell !== range.end) {
            range.setEnd(cell);
        }
    };
    self.onCellFocus = function (event) {
        if (event.target === range.start) {
            return;
        }

        setTimeout(function () {
            range.setStart(event.target);
        }, 0);
    };
    self.onReturn = function (event, preventMove) {
        if (preventMove !== true) {
            range.moveInDirection('Down');
        }
        event.preventDefault();
    };
    self.onArrows = function (event) {
        var newStartOrEnd, newTable;

        if (event.shiftKey && !event.ctrlKey) {
            newStartOrEnd = range.extendInDirection(self.keyCodeIdentifier[event.keyCode]);
        }
        else if (!event.ctrlKey) {
            newStartOrEnd = range.moveInDirection(self.keyCodeIdentifier[event.keyCode]);
            newTable = newStartOrEnd && newStartOrEnd.parentNode && newStartOrEnd.parentNode.parentNode.parentNode;

            updateSelectionMapping(newStartOrEnd);
        } else if(event.ctrlKey) {
            if(event.shiftKey){
                // Extend selection all the way to the end.
                newStartOrEnd = range.extendInDirection(self.keyCodeIdentifier[event.keyCode], true);
            }
            else {
                // Move selection all the way to the end.
                newStartOrEnd = range.moveInDirection(self.keyCodeIdentifier[event.keyCode], true);
                updateSelectionMapping(newStartOrEnd);
            }
        }

        if (newStartOrEnd) {
            event.preventDefault();
        }
    };
    self.onCopy = function () {
        var cells = range.getCells(),
            cols = cells[cells.length - 1].cellIndex - cells[0].cellIndex + 1,
            rows = cells.length / cols,
            lines = [],
            i = 0;

        cells.forEach(function (cell) {
            var lineIndex = i % rows,
                rowIndex = Math.floor(i / rows);

            lines[lineIndex] = lines[lineIndex] || [];
            lines[lineIndex][rowIndex] = ko.utils.unwrapObservable(cell._cellValue());

            i++;
        });

        return lines.map(function (line) {
            return line.join('\t');
        }).join('\r\n');
    };
    self.onPaste = function (text) {
        var selStart = range.getCells()[0],
            cells,
            values = text.trim().split(/\r?\n/).map(function (line) { return line.split('\t'); }),
            row = values.length,
            col = values[0].length,
            rows = 1,
            cols = 1,
            i = 0;

        range.setStart(selStart);

        while (row-- > 1 && range.extendInDirection('Down')) { rows++; }
        while (col-- > 1 && range.extendInDirection('Right')) { cols++; }

        cells = range.getCells();

        for (col = 0; col < cols; col++) {
            for (row = 0; row < rows; row++) {
                self.updateCellValue(cells[i], values[row][col]);
                i++;
            }
        }
    };
    self.onTab = function (event) {
        range.start.focus();
    };
    self.keyCodeIdentifier = {
        37: 'Left',
        38: 'Up',
        39: 'Right',
        40: 'Down'
    };
}
},{"events":10,"./selectionView":11,"./selectionRange":12,"./polyfill":3}],11:[function(require,module,exports){
var polyfill = require('./polyfill');

module.exports = SelectionView;

function SelectionView (table, selection) {
    var self = this,
        html = document.getElementsByTagName('html')[0];

    self.viewport = {};

    self.element = document.createElement('div');
    self.element.className = 'editable-cell-selection';
    self.element.style.position = 'absolute';
    self.element.style.display = 'none';
    self.element.tabIndex = -1;

    self.inputElement = document.createElement('input');
    self.inputElement.className = 'editable-cell-input';
    self.inputElement.style.position = 'absolute';
    self.inputElement.style.display = 'none';

    self.copyPasteElement = document.createElement('textarea');
    self.copyPasteElement.style.position = 'absolute';
    self.copyPasteElement.style.opacity = '0.0';
    self.copyPasteElement.style.display = 'none';

    table.parentNode.insertBefore(self.element, table.nextSibling);
    table.parentNode.insertBefore(self.inputElement, table.nextSibling);
    table.appendChild(self.copyPasteElement);

    self.destroy = function () {
        self.element.removeEventListener('mousedown', self.onMouseDown);
        self.element.removeEventListener('dblclick', self.onDblClick);
        self.element.removeEventListener('keypress', self.onKeyPress);
        self.element.removeEventListener('keydown', self.onKeyDown);

        self.inputElement.removeEventListener('keydown', self.onInputKeydown);
        self.inputElement.removeEventListener('blur', self.onInputBlur);

        html.removeEventListener('mouseup', self.onMouseUp);

        table.parentNode.removeChild(self.element);
        table.parentNode.removeChild(self.inputElement);
        table.removeChild(self.copyPasteElement);
    };
    self.show = function () {
        self.element.style.display = 'block';
        self.element.focus();

        var margin = 10,
            viewportTop = resolve(self.viewport.top) || 0,
            viewportBottom = resolve(self.viewport.bottom) || window.innerHeight,
            rect = selection.getRange().end.getBoundingClientRect(),
            topOffset = rect.top - margin - viewportTop,
            bottomOffset = viewportBottom - rect.bottom - margin;

        if (topOffset < 0) {
            document.body.scrollTop += topOffset;
        }
        else if (bottomOffset < 0) {
            document.body.scrollTop -= bottomOffset;
        }
    };
    
    function resolve (value) {
        if (typeof value === 'function') {
            return value();
        }

        return value;
    }

    self.hide = function () {
        self.element.style.display = 'none';
    };
    self.focus = function () {
        self.element.focus();
    };
    self.update = function (start, end) {
        var top = Math.min(start.offsetTop, end.offsetTop),
            left = Math.min(start.offsetLeft, end.offsetLeft),
            bottom = Math.max(start.offsetTop + start.offsetHeight,
                            end.offsetTop + end.offsetHeight),
            right = Math.max(start.offsetLeft + start.offsetWidth,
                            end.offsetLeft + end.offsetWidth);

        self.element.style.top = table.offsetTop + top + 1 + 'px';
        self.element.style.left = table.offsetLeft + left + 1 + 'px';
        self.element.style.height = bottom - top - 1 + 'px';
        self.element.style.width = right - left - 1 + 'px';
        self.element.style.backgroundColor = 'rgba(245, 142, 00, 0.15)';

        self.show();
    };
    self.beginDrag = function () {
        self.canDrag = true;
        self.element.addEventListener('mousemove', self.doBeginDrag);
    };
    self.doBeginDrag = function () {
        self.element.removeEventListener('mousemove', self.doBeginDrag);

        if (!self.canDrag) {
            return;
        }

        self.isDragging = true;
        self.element.style.pointerEvents = 'none';
    };
    self.endDrag = function () {
        self.element.removeEventListener('mousemove', self.doBeginDrag);
        self.isDragging = false;
        self.canDrag = false;
        self.element.style.pointerEvents = 'inherit';
    };

    self.onMouseUp = function (event) {
        self.endDrag();
    };
    self.onMouseDown = function (event) {
        if (event.button !== 0) {
            return;
        }

        self.hide();

        var cell = event.view.document.elementFromPoint(event.clientX, event.clientY);
        selection.onCellMouseDown(cell, event.shiftKey);

        event.preventDefault();
    };
    self.onDblClick = function (event) {
        selection.startLockedEditing();
    };
    self.onKeyPress = function (event) {
        selection.startEditing();
    };
    self.onKeyDown = function (event) {
        if (event.keyCode === 13) {
            selection.onReturn(event);
        } else if ([37, 38, 39, 40].indexOf(event.keyCode) !== -1) {
            selection.onArrows(event);
        } else if (event.keyCode === 86 && event.ctrlKey) {
            self.copyPasteElement.value = '';
            self.copyPasteElement.style.display = 'block';
            self.copyPasteElement.focus();
            setTimeout(function () {
                selection.onPaste(self.copyPasteElement.value);
                self.copyPasteElement.style.display = 'none';
                self.focus();
            }, 0);
        } else if (event.keyCode === 67 && event.ctrlKey) {
            self.copyPasteElement.value = selection.onCopy();
            self.copyPasteElement.style.display = 'block';
            self.copyPasteElement.focus();
            document.execCommand('selectAll', false, null);
            setTimeout(function () {
                self.copyPasteElement.style.display = 'none';
                self.focus();
            }, 0);
        } else if (event.keyCode === 9) {
            selection.onTab(event);
        }
    };
    self.onInputKeydown = function (event) {
        var cell = selection.getRange().start;

        if (event.keyCode === 13) { // Return
            var value = selection.endEditingCell(cell);

            if (event.ctrlKey) {
                selection.getCells().forEach(function (cellInSelection) {
                    if (cellInSelection !== cell) {
                        selection.updateCellValue(cellInSelection, value);
                    }
                });
            }

            selection.onReturn(event, event.ctrlKey);
            self.focus();
            event.preventDefault();
        }
        else if (event.keyCode === 27) { // Escape
            selection.cancelEditingCell(cell);
            self.focus();
        }
        else if ([37, 38, 39, 40].indexOf(event.keyCode) !== -1) { // Arrows
            if(!self.isLockedToCell) {
                self.focus();
                selection.onArrows(event);
                event.preventDefault();
            }
        }
    };
    self.onInputBlur = function (event) {
        if (!selection.isEditingCell()) {
            return;
        }
        selection.endEditingCell(selection.getRange().start);
    };

    self.element.addEventListener("mousedown", self.onMouseDown);
    self.element.addEventListener("dblclick", self.onDblClick);
    self.element.addEventListener("keypress", self.onKeyPress);
    self.element.addEventListener("keydown", self.onKeyDown);

    self.inputElement.addEventListener("keydown", self.onInputKeydown);
    self.inputElement.addEventListener("blur", self.onInputBlur);

    html.addEventListener("mouseup", self.onMouseUp);
}
},{"./polyfill":3}],12:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    polyfill = require('./polyfill');

module.exports = SelectionRange;

SelectionRange.prototype = new EventEmitter();

function SelectionRange (getRowByIndex, getCellByIndex, cellIsSelectable, cellIsVisible) {
    var self = this;

    self.start = undefined;
    self.end = undefined;
    self.selection = [];

    function setSelection (cells) {
        self.selection = cells;
        self.emit('change', cells);
    }

    self.moveInDirection = function (direction, toEnd) {
        var newStart = toEnd ? self.getLastSelectableCellInDirection(self.start, direction) : self.getSelectableCellInDirection(self.start, direction),
            startChanged = newStart !== self.start,
            belongingToOtherTable = newStart.parentNode.parentNode.parentNode !== self.start.parentNode.parentNode.parentNode;

        if (!belongingToOtherTable && (startChanged || self.start !== self.end)) {
            self.setStart(newStart);
        }

        if (startChanged) {
            return newStart;
        }
    };

    self.extendInDirection = function (direction, toEnd) {
        var newEnd = toEnd ? self.getLastSelectableCellInDirection(self.end, direction) : self.getCellInDirection(self.end, direction),
            endChanged = newEnd && newEnd !== self.end;

        if (newEnd) {
            self.setEnd(newEnd);    
        }

        if (endChanged) {
            return newEnd;
        }
    };

    self.getCells = function () {
        return self.getCellsInArea(self.start, self.end);
    };

    self.clear = function () {
        self.start = undefined;
        self.end = undefined;
        setSelection([]);
    };

    self.destroy = function () {
        self.removeAllListeners('change');
        self.clear();
    };

    self.setStart = function (element) {
        self.start = element;
        self.end = element;
        setSelection(self.getCells());
    };
    self.setEnd = function (element) {
        if (element === self.end) {
            return;
        }
        self.start = self.start || element;

        var cellsInArea = self.getCellsInArea(self.start, element),
            allEditable = true;

        cellsInArea.forEach(function (cell) {
            allEditable = allEditable && cellIsSelectable(cell);
        });

        if (!allEditable) {
            return;
        }

        self.end = element;
        setSelection(self.getCells());
    };
    self.getCellInDirection = function (originCell, direction) {

        var rowIndex = originCell.parentNode.rowIndex;
        var cellIndex = getCellIndex(originCell);

        var table = originCell.parentNode.parentNode.parentNode,
            row = getRowByIndex(rowIndex + getDirectionYDelta(direction), table),
            cell = row && getCellByIndex(row, cellIndex + getDirectionXDelta(direction, originCell));

        if (direction === 'Left' && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }
        if (direction === 'Up' && row && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }
        if (direction === 'Right' && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }
        if (direction === 'Down' && row && cell) {
            return cellIsVisible(cell) && cell || self.getCellInDirection(cell, direction);
        }

        return undefined;
    };
    self.getSelectableCellInDirection = function (originCell, direction) {
        var lastCell,
            cell = originCell;

        while (cell) {
            cell = self.getCellInDirection(cell, direction);

            if (cell && cellIsSelectable(cell)) {
                return cell;
            }
        }

        return originCell;
    };
    self.getLastSelectableCellInDirection = function (originCell, direction) {
        var nextCell = originCell;
        do {
            cell = nextCell;
            nextCell = self.getSelectableCellInDirection(cell, direction);
        } while(nextCell !== cell);

        return cell;
    };
    self.getCellsInArea = function (startCell, endCell) {
        var startX = Math.min(getCellIndex(startCell), getCellIndex(endCell)),
            startY = Math.min(startCell.parentNode.rowIndex, endCell.parentNode.rowIndex),
            endX = Math.max(getCellIndex(startCell), getCellIndex(endCell)),
            endY = Math.max(startCell.parentNode.rowIndex, endCell.parentNode.rowIndex),
            x, y,
            cell,
            cells = [];

        for (x = startX; x <= endX; ++x) {
            for (y = startY; y <= endY; ++y) {
                cell = getCellByIndex(getRowByIndex(y), x);
                if(cellIsVisible(cell)) {
                    cells.push(cell || {});
                }
            }
        }

        return cells;
    };
    
    function getDirectionXDelta (direction, cell) {
        if (direction === 'Left') {
            return -1;
        }

        if (direction === 'Right') {
            return cell.colSpan;
        }

        return 0;
    }

    function getDirectionYDelta (direction) {
        if (direction === 'Up') {
            return -1;
        }

        if (direction === 'Down') {
            return 1;
        }

        return 0;
    }

    function getCellIndex (cell) {
        var row = cell.parentNode,
            colSpanSum = 0,
            i;

        for (i = 0; i < row.children.length; i++) {
            if (row.children[i] === cell) {
                break;
            }

            colSpanSum += row.children[i].colSpan;
        }

        return colSpanSum;
    }
}
},{"events":10,"./polyfill":3}]},{},[1])(1)
});
;