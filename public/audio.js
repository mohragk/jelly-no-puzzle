         
// for legacy browsers
const AudioContext = window.AudioContext || window.webkitAudioContext;


function unlockAudioContext(audioCtx) {
    if (audioCtx.state !== 'suspended') return;
    const b = document.body;
    const events = ['touchstart','touchend', 'mousedown','keydown'];
    events.forEach(e => b.addEventListener(e, unlock, false));
    function unlock() { audioCtx.resume().then(clean); }
    function clean() { events.forEach(e => b.removeEventListener(e, unlock)); }
}

export class SoundBank {
    sounds = new Map();
    available_sounds = [];

    // NOTE: sound clips are loaded via the DOM, maybe move that
    // to actual JS?
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

    getAllAvailable() {
        return this.available_sounds;
    }
};



export class AudioPlayer {
    audio_context;
    #is_on = true;

    toggle_button;

   
    constructor () {

        this.initialize();

        this.toggle_button = document.getElementById('audio_toggle_button');
        if (this.toggle_button) {
            this.toggle_button.onclick = (e) => {
                e.preventDefault();
                this.toggle();
                this.toggle_button.innerHTML = this.#is_on ? "turn off" : "turn on";
            }
        }
    }

    initialize() {
        this.audio_context = new AudioContext();
        unlockAudioContext(this.audio_context);

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
            unlockAudioContext(this.audio_context);

            this.reset(clip);

            let prom = clip.play();
            if (prom !== 'undefined') {
                prom.then( () => {
                    console.log("Playing audio!")
                })
                .catch( err => {   
                    console.error(err)
                })
            }
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


