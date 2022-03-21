         
// for legacy browsers
const AudioContext = window.AudioContext || window.webkitAudioContext;


export class AudioPlayer {
    audio_context = new AudioContext();
    #is_on = true;

    toggle_button;
    constructor () {
        this.toggle_button = document.getElementById('audio_toggle_button');
        if (this.toggle_button) {
            this.toggle_button.onclick = (e) => {
                e.preventDefault();
                this.toggle();
                this.toggle_button.innerHTML = this.#is_on ? "turn off" : "turn on";
            }
        }

    }

    trigger(clip) {
        if (this.#is_on) {
            this.reset(clip);
            clip.play();
        }
    }

    reset (clip) {
        clip.pause();
        clip.currentTime = 0;
    }

    toggle() {
        this.#is_on = !this.#is_on;
    }
}