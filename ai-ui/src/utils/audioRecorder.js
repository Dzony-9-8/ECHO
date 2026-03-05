export const startConfiguredRecording = async (onDataAvailable, onStop) => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        let audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
            if (onDataAvailable) onDataAvailable(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            if (onStop) onStop(audioBlob);

            // Cleanup stream
            stream.getTracks().forEach(track => track.stop());
        });

        mediaRecorder.start();
        return mediaRecorder;
    } catch (err) {
        console.error("Error accessing microphone:", err);
        throw err;
    }
};
