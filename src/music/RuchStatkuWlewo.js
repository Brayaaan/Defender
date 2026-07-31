// 1. Zdefiniowanie obiektu Audio RAZ na początku pliku
const soundRuchWlewo = new Audio("src/music/Ogg/RuchStatkuWlewo.Ogg");

// 2. Ustawienie, aby dźwięk się zapętlał
soundRuchWlewo.loop = true;

// 3. Funkcja sterująca (playSoundRuchStatkuWlewo)
function playSoundRuchStatkuWlewo(play) {
  if (play) {
    // Włącz: Jeśli dźwięk jest zatrzymany, odtwórz go
    if (soundRuchWlewo.paused) {
      soundRuchWlewo.play().catch(e => console.error("Błąd odtwarzania w lewo:", e));
    }
  } else {
    // Wyłącz: Zastopuj dźwięk i przewiń na początek
    soundRuchWlewo.pause();
    soundRuchWlewo.currentTime = 0; 
  }
}