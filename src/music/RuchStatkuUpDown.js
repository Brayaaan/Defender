// 1. Zdefiniowanie obiektu Audio RAZ na początku pliku
const soundRuchUpDown = new Audio("src/music/Ogg/RuchStatkuUpDown.Ogg");

// 2. Ustawienie, aby dźwięk się zapętlał
soundRuchUpDown.loop = true;

// 3. Funkcja sterująca (playSoundRuchStatkuUpDown)
function playSoundRuchStatkuUpDown(play) {
  if (play) {
    // Włącz: Jeśli dźwięk jest zatrzymany, odtwórz go
    if (soundRuchUpDown.paused) {
      soundRuchUpDown.play().catch(e => console.error("Błąd odtwarzania góra/dół:", e));
    }
  } else {
    // Wyłącz: Zastopuj dźwięk i przewiń na początek
    soundRuchUpDown.pause();
    soundRuchUpDown.currentTime = 0; 
  }
}