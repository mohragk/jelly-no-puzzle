export class DelayedTrigger {
    #duration = 1.0;
    #elapsed  = 0.0;
    armed = false;
    running = false;
    callback  = () => {};

    constructor(duration, cb) {
        this.#duration = duration;
        this.callback = cb;
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
    }

    reset() {
        this.#elapsed = 0.0;
    }

    armAndReset() {
        this.arm(true);
        this.reset();
    }
}