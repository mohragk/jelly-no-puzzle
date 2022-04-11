function clone(item) {
    if (!item) { return item; } // null, undefined values check

    var types = [ Number, String, Boolean ], 
        result;

    // normalizing primitives if someone did new String('aaa'), or new Number('444');
    types.forEach(function(type) {
        if (item instanceof type) {
            result = type( item );
        }
    });

    if (typeof result == "undefined") {
        if (Object.prototype.toString.call( item ) === "[object Array]") {
            result = [];
            item.forEach(function(child, index, array) { 
                result[index] = clone( child );
            });
        } else if (typeof item == "object") {
            // testing that this is DOM
            if (item.nodeType && typeof item.cloneNode == "function") {
                result = item.cloneNode( true );    
            } else if (!item.prototype) { // check that this is a literal
                if (item instanceof Date) {
                    result = new Date(item);
                } else {
                    // it is an object literal
                    result = {};
                    for (var i in item) {
                        result[i] = clone( item[i] );
                    }
                }
            } else {
                // depending what you would like here,
                // just keep the reference, or create new object
                if (false && item.constructor) {
                    // would not advice to do that, reason? Read below
                    result = new item.constructor();
                } else {
                    result = item;
                }
            }
        } else {
            result = item;
        }
    }

    return result;
}

export class Recorder {
    history = [];
    count = 0;
    max = 16;

    constructor() {
        this.history.length = this.max;
    }

    add(state) {
        if (this.count >= this.history.length) {
            this.max *= 2;
            this.history.length = this.max;
        }
        // NOTE: replaced from JSON.parse(JSON.stringify()) for (maybe) better performance.
        this.history[this.count] =  clone(state);   
        this.count++;
    }

    getPrevious() {
        this.count --;
        if (this.count < 0) {
            this.count = 0;
        }
        return this.history[this.count];
    }
}
