         
// for legacy browsers
const AudioContext = window.AudioContext || window.webkitAudioContext;


export class SoundBank {
    sounds = new Map();
    available_sounds = [];

    add(name) {
        const element = document.getElementById(name);
        if (!element) {
            console.error(`No DOM sound element found for name: ${name}!`)
            return false;
        }
        
        this.sounds.set(name, element);
        this.available_sounds.push(name);
        return true;
    }

    get(name) {
        const el = this.sounds.get(name);
        return el;
    }
};


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

    notFound() {
        console.error(`AudioPlayer -- Audio clip not found!`)
    }

    trigger(clip) {
        if (!clip) {
            this.notFound();
            return;
        } 

        if (this.#is_on) {
            this.reset(clip);
            clip.play();
        }
    }

    reset (clip) {
        if (!clip)  {
            this.notFound();
            return;
        }

        clip.pause();
        clip.currentTime = 0;
    }

    toggle() {
        this.#is_on = !this.#is_on;
    }
}


