// Obraz wczytywany natywnie
window.galaktykaImage = new Image();
window.galaktykaLoaded = false;

window.galaktykaImage.onload = () => {
  window.galaktykaLoaded = true;
  console.log("Obraz galaktyka.png załadowany");
};
window.galaktykaImage.onerror = (e) => {
  console.error("Błąd ładowania galaktyka.png", e);
};

window.galaktykaImage.src = "src/foto/zwyciezcy/galaktyka.png";