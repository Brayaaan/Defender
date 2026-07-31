// Obraz wczytywany natywnie
window.EchoImage = new Image();
window.EchoLoaded = false;

window.EchoImage.onload = () => {
  window.EchoLoaded = true;

};


window.EchoImage.src = "src/foto/AI/Echo.jpg"; // Poprawiona linijka