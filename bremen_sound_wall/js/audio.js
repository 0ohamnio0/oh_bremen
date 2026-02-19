export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.isReady = false;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048; // Higher resolution for frequency analysis
            this.analyser.smoothingTimeConstant = 0.75; // Slightly faster response for voice
            
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.waveArray = new Uint8Array(this.analyser.fftSize); // time-domain waveform
            this.isReady = true;
            
            // Resume if suspended (browser policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            console.log("Audio Initialized");
        } catch (e) {
            console.error("Audio Access Denied", e);
            alert("Microphone access is required for this experience.");
        }
    }

    getAudioData() {
        if (!this.isReady) return { amplitude: 0, frequency: 0, complexity: 0, bass: 0, mid: 0, high: 0, waveform: null };

        this.analyser.getByteFrequencyData(this.dataArray);
        this.analyser.getByteTimeDomainData(this.waveArray);

        const nyquist = this.audioContext.sampleRate / 2;
        const binHz = nyquist / this.dataArray.length;

        // 1. Calculate Amplitude
        let sum = 0;
        let max = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
            max = Math.max(max, this.dataArray[i]);
        }
        const amplitude = Math.max(sum / this.dataArray.length / 255, (max / 255) * 0.5);

        // 2. Estimate Pitch (Peak Index)
        let maxValue = 0;
        let maxIndex = 0;
        for (let i = 10; i < this.dataArray.length; i++) {
            if (this.dataArray[i] > maxValue) {
                maxValue = this.dataArray[i];
                maxIndex = i;
            }
        }
        const frequencyHz = maxIndex * (nyquist / this.dataArray.length);
        const frequency = maxValue < 30 ? 0 : Math.min(frequencyHz / 8000, 1);

        // 3. Complexity (Peak Count)
        let peakCount = 0;
        for (let i = 1; i < this.dataArray.length - 1; i++) {
            if (this.dataArray[i] > 100 &&
                this.dataArray[i] > this.dataArray[i - 1] &&
                this.dataArray[i] > this.dataArray[i + 1]) {
                peakCount++;
            }
        }
        const complexity = Math.min(peakCount / 20, 1);

        // 4. 3-Band Split — voice-optimised boundaries
        //    bass : 80–400 Hz  (fundamental / low formants) — boosted ×1.8
        //    mid  : 400–2000 Hz (vowel formants — richest for voice)
        //    high : 2000–8000 Hz (consonants, sibilants)
        const bassStart = Math.max(1, Math.floor(80   / binHz));
        const bassEnd   = Math.floor(400  / binHz);
        const midEnd    = Math.floor(2000 / binHz);
        const highEnd   = Math.min(this.dataArray.length - 1, Math.floor(8000 / binHz));

        let bassSum = 0;
        for (let i = bassStart; i <= bassEnd; i++) bassSum += this.dataArray[i];
        const bass = Math.min((bassSum / (bassEnd - bassStart + 1)) / 255 * 1.8, 1);

        let midSum = 0;
        for (let i = bassEnd + 1; i <= midEnd; i++) midSum += this.dataArray[i];
        const mid = Math.min((midSum / (midEnd - bassEnd)) / 255, 1);

        let highSum = 0;
        for (let i = midEnd + 1; i <= highEnd; i++) highSum += this.dataArray[i];
        const high = Math.min((highSum / (highEnd - midEnd)) / 255, 1);

        return {
            amplitude,
            frequency,
            complexity,
            bass,
            mid,
            high,
            waveform: this.waveArray, // Uint8Array(2048), 128=silence, 0–255
        };
    }
}
