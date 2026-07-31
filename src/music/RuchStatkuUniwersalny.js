// src/music/Ogg/RuchStatkuUniwersalny.js

// 1. Zdefiniowanie obiektu Audio RAZ na początku pliku
const soundRuchUniwersalny = new Audio("src/music/Ogg/RuchStatkuUniwersalny.Ogg");

// ⭐ NOWA LINIA: Ustawienie głośności na 30% (możesz dostosować)
soundRuchUniwersalny.volume = 0.3; 

// 2. Ustawienie, aby dźwięk się zapętlał
soundRuchUniwersalny.loop = true;

// 3. Funkcja sterująca
function playSoundRuchStatkuUniwersalny(play) {
  if (play) {
    if (soundRuchUniwersalny.paused) {
      soundRuchUniwersalny.play().catch(e => console.error("Błąd odtwarzania uniwersalnego:", e));
    }
  } else {
    soundRuchUniwersalny.pause();
    soundRuchUniwersalny.currentTime = 0; 
  }
}