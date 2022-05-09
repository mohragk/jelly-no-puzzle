         
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


async function getAudioFile(audio_context, filepath) {
    const res = await fetch(filepath);
    if (res.status === 200) {
        const data         = await res.arrayBuffer();
        const audio_buffer = await audio_context.decodeAudioData(data);

        return audio_buffer;
    }

    return null;
}



export class SoundBank {
    sounds = new Map();
    base_path;

    async add(file_name, audio_context, load_manager) {
        load_manager.itemStart();
        const audio_buffer = await getAudioFile(audio_context, this.base_path+file_name, load_manager);

        if (audio_buffer) {
            this.sounds.set(file_name, audio_buffer);
            load_manager.itemEnd();
        }
        else {
            console.error(`[SoundBank] Can't load audio_buffer: ${file_name}. Loading halted!`);
            return;
        }
    }

    get(name) {
        const el = this.sounds.get(name);
        if (!el) console.error(`[SoundBank] No clip found with name: ${name}!`);
        
        return el;
    }
};



export class AudioPlayer {
    audio_context;
    #is_on = true;

    toggle_button;

    global_gain;
    mixer;
   
    constructor () {

        this.createAndUnlockContext();

        this.toggle_button = document.getElementById('audio_toggle_button');
        if (this.toggle_button) {
            this.toggle_button.onclick = (e) => {
                e.preventDefault();
                this.toggle();
                this.toggle_button.innerHTML = this.#is_on ? "turn off" : "turn on";
            }
        }

        this.global_gain = this.audio_context.createGain();
        this.global_gain.gain.value = 2.5;
        this.global_gain.connect(this.audio_context.destination);
    }

    createAndUnlockContext() {
        this.audio_context = new AudioContext();
        unlockAudioContext(this.audio_context);
    }

    notFound() {
        console.error(`[AudioPlayer] Audio clip not found!`)
    }

    trigger(buffer) {
        if (!buffer) {
            this.notFound();
            return;
        } 

        if (this.#is_on) {
            unlockAudioContext(this.audio_context);

            const sample_source = this.audio_context.createBufferSource();
            sample_source.buffer = buffer;
            sample_source.connect(this.global_gain)
            sample_source.start();
            
        }
    }

    toggle() {
        this.#is_on = !this.#is_on;
    }
}


