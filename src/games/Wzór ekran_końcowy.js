let frameCountOffset = 0; // Zmienna globalna do synchronizacji animacji
let animationTime = 0; // Nowy licznik czasu dla animacji

// Trzecia funkcja: Ekran z kontenerem po kraksie
function showFotoCrashScreen() {
    background(0); // Rysuje czarne tło

    // Parametry dla kwadratowego kontenera o stałym rozmiarze
    let boxSize = 600;
    let boxX = (width - boxSize) / 2;
    let boxY = (height - boxSize) / 2;

    // Rysowanie niebieskiej ramki o zaokrąglonych rogach
    noFill();
    stroke(0, 0, 255); // Kolor niebieski
    strokeWeight(4);
    rect(boxX, boxY, boxSize, boxSize, 20); // 20 to promień zaokrąglenia

    // Tu dodajemy kod do rysowania zdjęcia wewnątrz ramki
    if (window.kraksaLoaded) {
      // Rysowanie natywnym Canvas API
      let ctx = drawingContext;
      // Wpasowanie obrazka w ramkę z 20-pikselowym marginesem
      ctx.drawImage(window.kraksaImage, boxX + 10, boxY + 10, boxSize - 20, boxSize - 20);
    } else {
      // Alternatywny tekst lub kształt, gdy obraz nie jest załadowany
      fill(255);
      textSize(24);
      textAlign(CENTER);
      text("Ładowanie obrazu kraksy...", width / 2, height / 2);
    }

    // Rysowanie napisu "Naciśnij Spację"
    textSize(32);
    fill(255); // Kolor biały
    textAlign(CENTER);
    text("Naciśnij Spację", width / 2, boxY + boxSize + 50); // Tekst pod ramką
}

function showGameOverScreen() {
  // Strefa 1: Ramka dla napisu na górze i Twój wynik
  let topBoxWidth = 0.65 * width;
  let topBoxHeight = 0.18 * height;
  let margin = 10; // Odstęp 10 pikseli
  noFill();
  stroke(0, 0, 255); // Niebieska ramka
  strokeWeight(2);
  rect(width / 2 - topBoxWidth / 2, margin, topBoxWidth, topBoxHeight, 20); // Zaokrąglone wierzchołki
  fill(173, 216, 230); // Bardzo jasnoniebieski dla tekstu
  noStroke();
  textSize(0.04 * width);
  textAlign(CENTER);
  text("Koniec gry!", width / 2, margin + 0.07 * height); // Przesunięto niżej
  textSize(0.0208 * width);
  text(`Twój wynik: ${score}`, width / 2, margin + 0.13 * height);

  // Strefa 2: Ramka dla opisów skrótów po lewej z animacją strzałki
  let leftBoxWidth = 0.4 * width;
  let leftBoxHeight = 0.35 * height;
  noFill();
  stroke(0, 0, 255); // Niebieska ramka
  strokeWeight(2);
  rect(margin, topBoxHeight + 2 * margin, leftBoxWidth, leftBoxHeight, 20); // Odstęp od górnej ramki
  fill(173, 216, 230); // Bardzo jasnoniebieski
  noStroke();
  textSize(0.016 * width); // Zachowano mniejszy rozmiar
  textAlign(LEFT);
  drawAnimatedArrow(margin + 50, topBoxHeight + 2 * margin + 0.05 * height, frameCount + frameCountOffset); // Przesunięto w prawo o 40 pikseli
  let leftText1 = "Naciśnij spację aby\nkontynuować od tego poziomu";
  let leftText2 = "Naciśnij B aby zacząć od początku";
  let leftText3 = "Naciśnij M aby wrócić do Menu";
  push();
  fill(173, 216, 230);
  text(leftText1.substring(0, 8), margin + 60, topBoxHeight + 2 * margin + 0.05 * height); // "Naciśnij "
  pop();
  push();
  fill(34, 139, 34); // Ziemnozielony dla całego "spację"
  text(leftText1.substring(8, 15), margin + 60 + textWidth(leftText1.substring(0, 8)), topBoxHeight + 2 * margin + 0.05 * height); // "spację"
  pop();
  push();
  fill(173, 216, 230);
  text(leftText1.substring(15), margin + 60 + textWidth(leftText1.substring(0, 15)), topBoxHeight + 2 * margin + 0.05 * height); // " aby\nkontynuować od tego poziomu"
  pop();
  drawAnimatedArrow(margin + 50, topBoxHeight + 2 * margin + 0.15 * height, frameCount + frameCountOffset); // Przesunięto w prawo o 40 pikseli
  push();
  fill(173, 216, 230);
  text(leftText2.substring(0, 8), margin + 60, topBoxHeight + 2 * margin + 0.15 * height); // "Naciśnij "
  pop();
  push();
  fill(34, 139, 34); // Ziemnozielony dla "B"
  text(leftText2.substring(8, 9), margin + 60 + textWidth(leftText2.substring(0, 8)), topBoxHeight + 2 * margin + 0.15 * height); // "B"
  pop();
  push();
  fill(173, 216, 230);
  text(leftText2.substring(9), margin + 60 + textWidth(leftText2.substring(0, 9)), topBoxHeight + 2 * margin + 0.15 * height); // " aby zacząć od początku"
  pop();
  drawAnimatedArrow(margin + 50, topBoxHeight + 2 * margin + 0.25 * height, frameCount + frameCountOffset); // Przesunięto w prawo o 40 pikseli
  push();
  fill(173, 216, 230);
  text(leftText3.substring(0, 8), margin + 60, topBoxHeight + 2 * margin + 0.25 * height); // "Naciśnij "
  pop();
  push();
  fill(34, 139, 34); // Ziemnozielony dla "M"
  text(leftText3.substring(8, 9), margin + 60 + textWidth(leftText3.substring(0, 8)), topBoxHeight + 2 * margin + 0.25 * height); // "M"
  pop();
  push();
  fill(173, 216, 230);
  text(leftText3.substring(9), margin + 60 + textWidth(leftText3.substring(0, 9)), topBoxHeight + 2 * margin + 0.25 * height); // " aby wrócić do Menu"
  pop();

  // Strefa 3: Ramka dla tabeli wyników po prawej z animacją kul
  let rightBoxWidth = 0.5 * width - margin; // Dostosowane, aby zmieścić odstęp 10 pikseli
  let rightBoxHeight = 0.75 * height;
  noFill();
  stroke(0, 0, 255); // Niebieska ramka
  strokeWeight(2);
  rect(margin + leftBoxWidth + margin, topBoxHeight + 2 * margin, rightBoxWidth, rightBoxHeight, 20); // Odstęp 10 pikseli od lewej ramki
  fill(173, 216, 230); // Bardzo jasnoniebieski
  noStroke();
  textSize(0.015 * width); // Zachowano czcionkę dla linii 1-3
  textAlign(CENTER);
  text("Najlepsi piloci:", width / 2, topBoxHeight + 2 * margin + 0.05 * height);
  text("", width / 2, topBoxHeight + 2 * margin + 0.07 * height); // Pusta linia
  textAlign(LEFT);
  for (let i = 0; i < Math.min(highScores.length, 14); i++) { // Ograniczono do 14
    let yPos = topBoxHeight + 2 * margin + 0.1 * height + i * 0.05 * height; // Wrócono do pierwotnego odstępu
    if (i === 1) {
      drawBurningLine(margin, margin + leftBoxWidth + 2 * margin + 10, yPos - 0.025 * height - 10, rightBoxWidth - 20); // Kreska podniesiona o 10 pikseli
    }
    if (i < 3) { // Animacja dla pierwszych trzech miejsc
      fill(173, 216, 230); // Ustawienie koloru tekstu
      let nameText = `${i + 1}. ${highScores[i].name}   `; // 3 spacje po imieniu
      drawAnimatedFireball(margin + leftBoxWidth + 2 * margin + 10, yPos - 5, frameCount + frameCountOffset); // Kula przed imieniem
      text(nameText, margin + leftBoxWidth + 2 * margin + 20, yPos); // Numer i imię z 3 spacjami
      drawAnimatedFireball(margin + leftBoxWidth + 2 * margin + textWidth(nameText) + 20, yPos - 5, frameCount + frameCountOffset); // Kula po imieniu
      if (i === 1 || i === 2) {
        stroke(255, 0, 0); // Czerwone podkreślenie
        strokeWeight(1);
        line(margin + leftBoxWidth + 2 * margin + 10, yPos + 2, margin + leftBoxWidth + 2 * margin + rightBoxWidth - 30, yPos + 2); // Podkreślenie na całą szerokość
        noStroke();
      }
    } else if (i >= 3 && i <= 13) { // Linie od 4 do 14 z mniejszą czcionką i podkreśleniem
      fill(173, 216, 230); // Ustawienie koloru tekstu
      textSize(0.012 * width); // Zmniejszono czcionkę dla linii 4-14
      let nameText = (i >= 4) ? `${i + 1}. ${highScores[i].name}` : `${i + 1} ${highScores[i].name}`; // Numer z kropką od 4
      text(nameText, margin + leftBoxWidth + 2 * margin + 10, yPos);
      stroke(0, 0, 255); // Niebieskie podkreślenie
      strokeWeight(1);
      line(margin + leftBoxWidth + 2 * margin + 10, yPos + 2, margin + leftBoxWidth + 2 * margin + rightBoxWidth - 30, yPos + 2); // Podkreślenie na całą szerokość
      noStroke();
      textSize(0.015 * width); // Przywrócenie czcionki dla punktów
    } else if (i === 3) { // Dla 3
      fill(173, 216, 230); // Ustawienie koloru tekstu
      text(`${i + 1} ${highScores[i].name}`, margin + leftBoxWidth + 2 * margin + 10, yPos); // Spacja dla 3
    }
    textAlign(RIGHT);
    text(highScores[i].score, margin + leftBoxWidth + rightBoxWidth - 20, yPos); // Punkty po prawej
    textAlign(LEFT); // Przywrócenie wyrównania
  }
  // Aktualizacja czasu animacji
  animationTime += 0.016; // Przybliżony czas jednej klatki (1/60 FPS)
}

function showWinScreen() {
  // Strefa 1: Ramka dla napisu na górze i Twój wynik
  let topBoxWidth = 0.65 * width;
  let topBoxHeight = 0.18 * height;
  let margin = 10; // Odstęp 10 pikseli
  noFill();
  stroke(0, 0, 255); // Niebieska ramka
  strokeWeight(2);
  rect(width / 2 - topBoxWidth / 2, margin, topBoxWidth, topBoxHeight, 20); // Zaokrąglone wierzchołki
  fill(173, 216, 230); // Bardzo jasnoniebieski
  noStroke();
  textSize(0.04 * width);
  textAlign(CENTER);
  text("Wygrałeś. Przeleciałeś do końca!", width / 2, margin + 0.07 * height);
  textSize(0.0208 * width);
  text(`Twój wynik: ${score}`, width / 2, margin + 0.13 * height);

  // Strefa 2: Ramka dla opisów skrótów po lewej z animacją strzałki
  let leftBoxWidth = 0.4 * width;
  let leftBoxHeight = 0.35 * height;
  noFill();
  stroke(0, 0, 255); // Niebieska ramka
  strokeWeight(2);
  rect(margin, topBoxHeight + 2 * margin, leftBoxWidth, leftBoxHeight, 20); // Odstęp od górnej ramki
  fill(173, 216, 230); // Bardzo jasnoniebieski
  noStroke();
  textSize(0.016 * width); // Zachowano mniejszy rozmiar
  textAlign(LEFT);
  drawAnimatedArrow(margin + 50, topBoxHeight + 2 * margin + 0.05 * height, frameCount + frameCountOffset); // Przesunięto w prawo o 40 pikseli
  let leftText1 = "Naciśnij spację aby\nkontynuować od tego poziomu";
  push();
  fill(173, 216, 230);
  text(leftText1.substring(0, 8), margin + 60, topBoxHeight + 2 * margin + 0.05 * height); // "Naciśnij "
  pop();
  push();
  fill(34, 139, 34); // Ziemnozielony dla całego "spację"
  text(leftText1.substring(8, 15), margin + 60 + textWidth(leftText1.substring(0, 8)), topBoxHeight + 2 * margin + 0.05 * height); // "spację"
  pop();
  push();
  fill(173, 216, 230);
  text(leftText1.substring(15), margin + 60 + textWidth(leftText1.substring(0, 15)), topBoxHeight + 2 * margin + 0.05 * height); // " aby\nkontynuować od tego poziomu"
  pop();

  // Strefa 3: Ramka dla tabeli wyników po prawej
  let rightBoxWidth = 0.5 * width - margin; // Dostosowane, aby zmieścić odstęp 10 pikseli
  let rightBoxHeight = 0.75 * height;
  noFill();
  stroke(0, 0, 255); // Niebieska ramka
  strokeWeight(2);
  rect(margin + leftBoxWidth + margin, topBoxHeight + 2 * margin, rightBoxWidth, rightBoxHeight, 20); // Odstęp 10 pikseli od lewej ramki
  fill(173, 216, 230); // Bardzo jasnoniebieski
  noStroke();
  textSize(0.015 * width); // Zachowano czcionkę
  textAlign(CENTER);
  text("Najlepsi piloci:", width / 2, topBoxHeight + 2 * margin + 0.05 * height);
  // Aktualizacja czasu animacji
  animationTime += 0.016; // Przybliżony czas jednej klatki (1/60 FPS)
}

function drawAnimatedArrow(x, y, frameCount) {
  let t = frameCount * 0.05;
  let r = sin(t) * 50 + 100; // Płynne przejście od niebieskiego do jasnoniebieskiego
  let g = sin(t + 1) * 106 + 100;
  let b = cos(t) * 50 + 205;
  push();
  translate(x, y);
  rotate(t * 0.1); // Lekkie obracanie strzałki
  fill(r, g, b);
  triangle(0, -5, 10, 0, 0, 5); // Prosta strzałka
  for (let i = 0; i < 3; i++) {
    let sparkX = random(-5, 5);
    let sparkY = random(-10, 0);
    fill(r + random(-20, 20), g + random(-20, 20), b + random(-20, 20), 150);
    ellipse(sparkX, sparkY, 2, 2); // Iskry
  }
  pop();
}

function drawAnimatedFireball(x, y, frameCount) {
  let t = frameCount * 0.05; // Synchronizacja z innymi animacjami
  let r = sin(t) * 100 + 200; // Płynne przejście od czerwonego do pomarańczowego
  let g = sin(t + 1) * 50 + 100;
  let b = 0;
  push();
  translate(x, y);
  for (let i = 0; i < 5; i++) {
    let angle = i * TWO_PI / 5 + t;
    let radius = 5 + sin(t + i) * 2;
    let flameX = cos(angle) * radius;
    let flameY = sin(angle) * radius;
    fill(r + random(-20, 20), g + random(-20, 20), b, 200 - i * 40); // Płomienie z różną przezroczystością
    ellipse(flameX, flameY, 4, 4); // Małe płomienie wokół kuli
  }
  fill(r, g, b, 200); // Centrum kuli
  ellipse(0, 0, 10, 10); // Główna kula
  pop();
}

function drawBurningLine(margin, baseMargin, y, width) {
  let t = animationTime * 0.0005; // Zmniejszono prędkość animacji
  strokeWeight(2.5); // Zmniejszono dwukrotnie grubość kreski
  stroke(255, 165, 0); // Pomarańczowy kolor kreski
  line(baseMargin + 10, y, baseMargin + width, y); // Kreska
  noStroke();
  for (let i = 0; i < width / 10; i++) {
    let flameX = baseMargin + 10 + i * 10 + random(-5, 5);
    let flameY = y - (sin(t + i * 0.1) * 15 + 15); // Płomienie falują w górę
    let alpha = map(flameY, y - 30, y, 50, 200); // Przezroczystość maleje w górę
    fill(255, random(100, 200), 0, alpha); // Czerwono-pomarańczowy z losowym odcieniem
    push();
    translate(flameX, flameY);
    triangle(0, 0, random(2, 4), -random(5, 10), -random(2, 4), -random(5, 10)); // Płomień
    pop();
  }
}

function handleGameOverKeyPress() {
  if (gameState === 'gameOver' && keyCode === 32) {
    // Akcja dla ekranu po kraksie (game over) - TO DZIAŁA
    gameState = 'scoreScreen';

  } 
}

// Nowa, uniwersalna funkcja do obsługi klawiszy na wszystkich ekranach końcowych
function handleEndScreensKeyPress() {
    // Akcja dla ekranu po kraksie (gameState === 'gameOver')
    // oraz dla ekranu wygranej (gameState === 'win')
    if ((gameState === 'gameOver' || gameState === 'win') && keyCode === 32) {
        // Przejście do tabeli wyników
        gameState = 'scoreScreen';

    } 
    // Akcje dla ekranu z tabelą wyników (gameState === 'scoreScreen')
    else if (gameState === 'scoreScreen') {
        if (keyCode === 32) {
            resetGameFromLevel();
            gameState = 'playing';
            loop();

        } else if (key === 'B' || key === 'b') {
            resetGameFromStart();
            gameState = 'playing';
            loop();

        } else if (key === 'M' || key === 'm') {
            resetGame();
            gameState = 'start';
            loop();

        }
    }
}

function saveHighScore() {
  highScores.push({ name: playerName, score: score });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 14); // Ograniczono do 14
  localStorage.setItem('highScores', JSON.stringify(highScores));

}