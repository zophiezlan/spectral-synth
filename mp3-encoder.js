/**
 * MP3 Encoder - Convert audio buffers to MP3 format
 *
 * Uses lamejs library for browser-based MP3 encoding.
 * This is a lightweight wrapper around lamejs for easier integration.
 */

class MP3Encoder {
    /**
     * Encode audio buffer to MP3
     *
     * @param {AudioBuffer} audioBuffer - Audio buffer to encode
     * @param {number} bitrate - MP3 bitrate (default 128 kbps)
     * @returns {Blob} MP3 file as blob
     */
    static async encodeToMP3(audioBuffer, bitrate = 128) {
        // Check if lamejs is available
        if (typeof lamejs === 'undefined') {
            throw new Error('lamejs library not loaded. MP3 export requires the lamejs library.');
        }

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const samples = this.interleaveChannels(audioBuffer);

        // Create MP3 encoder
        const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);

        // Encode in chunks
        const mp3Data = [];
        const sampleBlockSize = 1152; // Standard MP3 frame size

        for (let i = 0; i < samples.length; i += sampleBlockSize) {
            const leftChunk = samples.left.subarray(i, i + sampleBlockSize);
            const rightChunk = numChannels === 2 ? samples.right.subarray(i, i + sampleBlockSize) : leftChunk;

            const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        // Finalize encoding
        const finalBuffer = mp3encoder.flush();
        if (finalBuffer.length > 0) {
            mp3Data.push(finalBuffer);
        }

        // Create blob
        return new Blob(mp3Data, { type: 'audio/mp3' });
    }

    /**
     * Interleave audio channels and convert to Int16
     *
     * @param {AudioBuffer} audioBuffer - Audio buffer
     * @returns {Object} Object with left and right channel data
     * @private
     */
    static interleaveChannels(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = numChannels === 2 ? audioBuffer.getChannelData(1) : leftChannel;

        // Convert Float32 to Int16
        const left = new Int16Array(length);
        const right = new Int16Array(length);

        for (let i = 0; i < length; i++) {
            // Clamp and convert to 16-bit PCM
            left[i] = this.floatToInt16(leftChannel[i]);
            right[i] = this.floatToInt16(rightChannel[i]);
        }

        return { left, right, length };
    }

    /**
     * Convert float sample to 16-bit integer
     *
     * @param {number} sample - Float sample value (-1.0 to 1.0)
     * @returns {number} 16-bit integer sample
     * @private
     */
    static floatToInt16(sample) {
        // Clamp to [-1, 1]
        sample = Math.max(-1, Math.min(1, sample));
        // Convert to 16-bit range
        return sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
}
