let echoMusic = null;
let fadeInterval = null;

function playEchoMusic() {
    // Sprawdź, czy muzyka już istnieje, aby nie tworzyć nowego obiektu
    if (!echoMusic) {
        echoMusic = new Audio("src/music/Ogg/Echo_Spirali_4.ogg");
        echoMusic.loop = true;
    }
    
    // Zatrzymaj proces ściszania, jeśli jest aktywny, i włącz muzykę
    clearInterval(fadeInterval);
    echoMusic.play();
}

function stopEchoMusic() {
    if (echoMusic && !echoMusic.paused) {
        fadeOutEchoMusic(echoMusic, 1000); // Wywołaj funkcję ściszania na 1 sekundę
    }
}

function fadeOutEchoMusic(audioElement, duration) {
    if (!audioElement) return;

    let startVolume = audioElement.volume;
    let frames = 60; // Liczba kroków
    let fadeStep = startVolume / frames;
    let fadeTime = duration / frames;

    // Użyj setInterval do stopniowego zmniejszania głośności
    fadeInterval = setInterval(() => {
        if (audioElement.volume > fadeStep) {
            audioElement.volume -= fadeStep;
        } else {
            // Gdy głośność spadnie do zera, zatrzymaj muzykę i wyczyść timer
            audioElement.pause();
            audioElement.volume = 1; // Zresetuj głośność na 100% dla następnego odtworzenia
            clearInterval(fadeInterval);
        }
    }, fadeTime);
}