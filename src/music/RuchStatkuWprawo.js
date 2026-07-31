// src/music/Ogg/RuchStatkuWprawo.js

// 1. Zdefiniowanie obiektu Audio RAZ na początku pliku
const soundRuchWprawo = new Audio("src/music/Ogg/RuchStatkuWprawo.Ogg");

// 2. Ustawienie, aby dźwięk się zapętlał
soundRuchWprawo.loop = true;

// 3. Funkcja sterująca, która przyjmuje argument 'play' (true/false)
function playSoundRuchStatkuWprawo(play) {
  if (play) {
    // Włącz: Jeśli dźwięk jest zatrzymany, odtwórz go
    if (soundRuchWprawo.paused) {
      // Użycie .catch zapobiega błędom, jeśli przeglądarka blokuje automatyczne odtwarzanie
      soundRuchWprawo.play().catch(e => console.error("Błąd odtwarzania w prawo:", e));
    }
  } else {
    // Wyłącz: Zastopuj dźwięk i przewiń na początek, by był gotowy do ponownego, natychmiastowego startu
    soundRuchWprawo.pause();
    soundRuchWprawo.currentTime = 0; 
  }
  
  // Zwracanie Promise z tym modelem nie jest konieczne, 
  // ponieważ odtwarzaniem zarządza teraz obiekt soundRuchWprawo.
}