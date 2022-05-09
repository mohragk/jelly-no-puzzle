class HTMLElement {
    #el;

    show() {
        this.#el.style.visibility = "visible";
    }

    hide() {
        this.#el.style.visibility = "hidden";
    }
}