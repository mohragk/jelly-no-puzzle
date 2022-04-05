export class LoadManager {
    is_loading = false;
    items_loaded = 0;
    items_total = 0;

    constructor(on_load) {
        this.on_load = on_load;
    }

    itemStart() {
        this.items_total++;

        if (!this.is_loading) {
            this.is_loading = true;
        }
    }

    itemEnd() {
        this.items_loaded++;

        if (this.items_loaded === this.items_total) {
            this.is_loading = false;
            if (this.on_load) this.on_load();
        }
    }

}