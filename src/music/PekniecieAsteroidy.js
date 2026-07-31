function playSoundPekniecieAsteroidy() {
  // 1. Definicja tablicy z nazwami plików dźwiękowych
  const sounds = [
    "PekniecieAsteroidyA.Ogg",
    "PekniecieAsteroidyB.Ogg",
    "PekniecieAsteroidyC.Ogg"
  ];
  
  // 2. Losowe wybranie jednego z dźwięków
  const randomIndex = Math.floor(Math.random() * sounds.length);
  const selectedSound = sounds[randomIndex];
  
  // 3. Pełna ścieżka do losowo wybranego pliku
  const soundPath = `src/music/Ogg/${selectedSound}`;
  
  // 4. Utworzenie i odtworzenie obiektu Audio
  const sound = new Audio(soundPath);
  
  // Opcjonalnie: ustawienie głośności, aby uniknąć przesterowania przy szybkim strzelaniu
  sound.volume = 1.0; 
  
  sound.play();
  
  // Opcjonalnie: aby uniknąć opóźnienia, jeśli gra jest zbyt szybka, 
  // można dodać obsługę zakończenia odtwarzania, aby usunąć element
  // sound.onended = function() { delete sound; };
}
