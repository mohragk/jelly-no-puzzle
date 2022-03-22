export class DelayedTrigger {
    #duration = 1.0;
    #elapsed  = 0.0;
    armed = false;
    running = false;
    callback  = () => {};
    armCallback = () => {};

    constructor(duration, cb, armcb = () => {}) {
        this.#duration = duration;
        this.callback = cb;
        this.armCallback = armcb;
    }

    update(dt) {
        if (!this.armed) return;
        this.running = true;
        this.#elapsed += dt;
        if (this.#elapsed > this.#duration) {
            this.callback();
            this.armed = false;
            this.running = false;
        }
    }

    arm(value) {
        this.armed = value;
        this.armCallback();
    }

    reset() {
        this.#elapsed = 0.0;
    }

    cancel() {
        this.#elapsed = 0.0;
        this.armed = false;
    }

    armAndReset() {
        this.arm(true);
        this.reset();
    }
}