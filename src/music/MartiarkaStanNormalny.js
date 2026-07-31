// Ta zmienna musi być poza funkcją, aby była "widoczna" dla całego pliku
let matriarkaNormalnyAudio = null;

function playSoundMartiarkaStanNormalny() {
    // Sprawdzamy, czy dźwięk już nie gra, żeby nie odpalać go kilka razy na raz
    if (!matriarkaNormalnyAudio) {
        matriarkaNormalnyAudio = new Audio("src/music/Ogg/MartiarkaStanNormalny.Ogg");
        matriarkaNormalnyAudio.loop = true; // To sprawi, że dźwięk będzie grał w kółko
        matriarkaNormalnyAudio.volume = 1; // Tło zazwyczaj powinno być nieco cichsze (np. 0.7 zamiast 1)
    }
    
    // Odtwarzamy tylko jeśli jest wstrzymany
    if (matriarkaNormalnyAudio.paused) {
        matriarkaNormalnyAudio.play().catch(e => console.log("Czekam na interakcję gracza..."));
    }
}

function stopSoundMartiarkaStanNormalny() {
    if (matriarkaNormalnyAudio) {
        matriarkaNormalnyAudio.pause();
        matriarkaNormalnyAudio.currentTime = 0; // Przewijamy do początku, by przy kolejnej walce grał od startu
    }
}