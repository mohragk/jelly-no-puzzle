         
// for legacy browsers
const AudioContext = window.AudioContext || window.webkitAudioContext;

// get the audio element

export class AudioPlayer {
    audio_context = new AudioContext();

    trigger(clip) {
        this.reset(clip);
        clip.play();
    }

    reset (clip) {
        clip.pause();
        clip.currentTime = 0;
    }
}