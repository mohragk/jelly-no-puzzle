export const Events = {
    MOVE: 0,
    IMPOSSIBLE: 1,
    BEGIN_FALL: 2,
    BEGIN_MERGE: 4,
    VICTORY: 5
}

export class EventManager {
    subscribers = [];
    
    addListener(listener) {
        this.subscribers.push(listener);
    }

    pushEvent(e) {
        for (let listener of this.subscribers) {
            // NOTE: in other languages, the Listener class should be defined.
            // In this case, JavaScript will just try to call it but give an 
            // error if the function is not defined. Good way to check whether
            // the function is actually implemented.
            listener.handleEvent(e);
        }
    }
}