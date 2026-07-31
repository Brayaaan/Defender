let musicIsPlaying = false;

let player;

let enemies = [];

let humanoids = [];

let shieldBoosts = [];

let immortalityBoosts = [];

let keys = [];

let weaponUpgrades = [];

let enemyBullets = [];

let asteroids = []; // NOWA: Tablica dla asteroid na poziomie 30

let cave = null;

let score = 0;

let level = 1;

let isPaused = false;

let spawnTimer = 500;

let caveTimer = 0;

let gameState = 'start';

let playerName = '';

let inputText = '';

let highScores = JSON.parse(localStorage.getItem('highScores')) || [];

let gameOverTimer = 0;

let currentLevel = null;

let weaponUpgradeSpawnTimer = 1000;

let fireController;

let astronautCount = 0; // Nowy licznik zebranych sfer Astronautów

let gameBackground;

// Flaga do jednokrotnego uruchomienia dźwięku uniwersalnego
let universalSoundIsPlaying = false;

// Osobna warstwa WEBGL na obiekty rysowane shaderami (np. Bat).
// Główny canvas gry ZOSTAJE w trybie 2D — ta warstwa jest doklejana na wierzch
// przez image() w draw(). Każda klasa korzystająca z shaderów musi dostawać
// tę warstwę jako argument do swojej metody show(), np. bat.show(gpuLayer).
let gpuLayer;


function setup() {
  createCanvas(windowWidth, windowHeight);
  // Osobna, przezroczysta warstwa WEBGL do rysowania shaderami (np. Bat).
  // Główny canvas zostaje 2D, więc reszta gry nie wymaga zmian.
  gpuLayer = createGraphics(windowWidth, windowHeight, WEBGL);
  gameBackground = new Background();
  player = new Player();
  fireController = new FireController(player);
  bombMechanics.init();

}

function windowResized() {
  // 1. Standardowa zmiana rozmiaru płótna
  resizeCanvas(windowWidth, windowHeight);

  // 1b. Warstwa WEBGL musi mieć ten sam rozmiar co canvas
  if (gpuLayer) {
    gpuLayer.resizeCanvas(windowWidth, windowHeight);
  }

  // 2. Logowanie usunięte

  // 3. NOWA LINIA: Aktualizacja gwiazd, aby wypełniły nowy rozmiar ekranu
  if (gameBackground && typeof gameBackground.initStars === 'function') {
    gameBackground.initStars();
  }
}

function draw() {
    // 1. Te dwie linijki muszą być pierwsze w funkcji draw()
    gameBackground.update();
    gameBackground.show();

   if ((gameState === 'start' || gameState === 'nameInput' || gameState === 'scoreScreen' || gameState === 'gameOver' || gameState === 'win') && !musicIsPlaying) {
       playEchoMusic();
       musicIsPlaying = true;
   } else if (gameState === 'playing' && musicIsPlaying) {
       stopEchoMusic();
       musicIsPlaying = false;
   }

    if (gameState === 'start') {
        showStartScreen();
    } else if (gameState === 'nameInput') {
        showNameInputScreen();
    } else if (gameState === 'playing') {
        // Główna pętla gry - tu dzieje się cała akcja

        if (isPaused) {
            textSize(0.03125 * width);
            fill(255, 0, 0);
            textAlign(CENTER);
            text("Pauza", width / 2, height / 2);
            return;

        }

        // --- W TYM MIEJSCU jest KOD rysowania KRĄŻOWNIKA ---
        let keysToRemove = [];
        if (keys.length > 0) {
            gpuLayer.clear();
            gpuLayer.push();
            gpuLayer.translate(-gpuLayer.width / 2, -gpuLayer.height / 2, 0);
            for (let i = 0; i < keys.length; i++) {
                keys[i].update(cave, player); 
                keys[i].show(gpuLayer);
                if (keys[i].collected(player)) {
                    // Brak punktów za samą kolizję
                    //tu mam wkleić wywołanie dżwięku do kontaktu z krążownikiem
                }
                if (keys[i].x + keys[i].width < 0) { 
                    keysToRemove.push(i);
                }
            }
            gpuLayer.pop();
            image(gpuLayer, 0, 0);
            for (let i = keysToRemove.length - 1; i >= 0; i--) {
                keys.splice(keysToRemove[i], 1);
            }
        }
        // --- KONIEC KODU do rysowania KRĄŻOWNIKA ---

        // Przygotowanie warstwy WEBGL na obiekty rysowane shaderami (np. Bat).
        // Czyścimy ją i przesuwamy układ współrzędnych tak, aby (0,0) było
        // w lewym górnym rogu — dokładnie jak na głównym canvasie 2D.
        gpuLayer.clear();
        gpuLayer.push();
        gpuLayer.translate(-gpuLayer.width / 2, -gpuLayer.height / 2, 0);

        if (cave) {
            cave.update();
            cave.show(gpuLayer); // UWAGA: cave.show() musi przyjmować i przekazywać gpuLayer dalej do ewentualnych Bat.show(pg)
            caveTimer--;
            if (caveTimer <= 0) {
                level++;
                cave = null;
                enemies = [];
                spawnTimer = 500;
                spawnLevel();

            }
        } else if (currentLevel) {
            // TUTAJ ZACZYNA SIĘ ZMODYFIKOWANA LOGIKA UPDATE:
            if (level === 30) {
                currentLevel.update(player); // Poziom 30: aktualizacja tylko z obiektem gracza (Player)
            } else {
                currentLevel.update(player, enemyBullets); // Standardowe poziomy: aktualizacja z graczem i pociskami wrogów
            }
            // TUTAJ KOŃCZY SIĘ ZMODYFIKOWANA LOGIKA UPDATE
            currentLevel.show(gpuLayer); // UWAGA: currentLevel.show() musi przyjmować i przekazywać gpuLayer dalej do Bat.show(pg)
            // Zmodyfikowany warunek przejścia na kolejny poziom
            if (level % 10 === 8) {
                // Na poziomach z krążownikiem, przejdź dalej tylko, gdy poziom jest ukończony i krążownik zniknął
                if (currentLevel.isLevelComplete() && keys.length === 0) {
                    level++;
                    enemies = [];
                    spawnTimer = 500;
                    spawnLevel();

                }
            } else {
                // Na pozostałych poziomach, przejdź dalej po normalnym zakończeniu
                if (currentLevel.isLevelComplete()) {
                    level++;
                    enemies = [];
                    spawnTimer = 500;
                    spawnLevel();

                }
            }
        }

        // Zamknięcie transformacji warstwy GPU i doklejenie jej na canvas 2D.
        // Robimy to PO narysowaniu cave/currentLevel (czyli po narysowaniu
        // nietoperzy), a PRZED rakietą/HUD-em, żeby gracz i interfejs
        // pozostały na wierzchu.
        gpuLayer.pop();
        image(gpuLayer, 0, 0);

        let humanoidsToRemove = [];
        let shieldBoostsToRemove = [];
        let immortalityBoostsToRemove = [];
        let weaponUpgradesToRemove = [];
        let bulletsToRemove = [];
        let enemyBulletsToRemove = [];

        // Wspólny przebieg GPU dla astronautów i wszystkich bonusów (shadery)
        gpuLayer.clear();
        gpuLayer.push();
        gpuLayer.translate(-gpuLayer.width / 2, -gpuLayer.height / 2, 0);

        if (humanoids.length > 0) {
            for (let i = 0; i < humanoids.length; i++) {

                // Sprawdzanie porwania astronauty
                for (let enemy of enemies) {
                    // Sprawdzamy, czy wróg ma metodę porywania
                    if (typeof enemy.abducts === 'function') {
                        enemy.abducts(humanoids[i]);
                    }
                }

                humanoids[i].update(cave);
                humanoids[i].show(gpuLayer);
                if (humanoids[i].collected(player)) {
                    score += 50;
                    astronautCount = min(20, astronautCount + 1); // Zwiększ licznik, max 20
                    humanoidsToRemove.push(i);
                    playSoundSferaAstronauty();

                }
                if (humanoids[i].x < 0) {
                    humanoidsToRemove.push(i);

                }
            }
            for (let i = humanoidsToRemove.length - 1; i >= 0; i--) {
                humanoids.splice(humanoidsToRemove[i], 1);
            }
        }
        if (shieldBoosts.length > 0) {
            for (let i = 0; i < shieldBoosts.length; i++) {
                shieldBoosts[i].update(cave);
                shieldBoosts[i].show(gpuLayer);
                if (shieldBoosts[i].collected(player)) {
                    player.shieldPower = min(100, player.shieldPower + 30);
                    shieldBoostsToRemove.push(i);
                    playSoundSferaMocy();

                }
                if (shieldBoosts[i].x < 0) {
                    shieldBoostsToRemove.push(i);

                }
            }
            for (let i = shieldBoostsToRemove.length - 1; i >= 0; i--) {
                shieldBoosts.splice(shieldBoostsToRemove[i], 1);
            }
        }
        if (immortalityBoosts.length > 0) {
            for (let i = 0; i < immortalityBoosts.length; i++) {
                immortalityBoosts[i].update(cave);
                immortalityBoosts[i].show(gpuLayer);
                if (immortalityBoosts[i].collected(player)) {
                    player.activateImmortality();
                    immortalityBoostsToRemove.push(i);
                    playSoundSferaNiesmiertelnosci();

                }
                if (immortalityBoosts[i].x < 0) {
                    immortalityBoostsToRemove.push(i);

                }
            }
            for (let i = immortalityBoostsToRemove.length - 1; i >= 0; i--) {
                immortalityBoosts.splice(immortalityBoostsToRemove[i], 1);
            }
        }

        if (weaponUpgrades.length > 0) {
            for (let i = 0; i < weaponUpgrades.length; i++) {
                weaponUpgrades[i].update(cave);
                weaponUpgrades[i].show(gpuLayer);
                if (weaponUpgrades[i].collected(player)) {
                    player.upgradeWeapon();
                    weaponUpgradesToRemove.push(i);
                    playSoundSferaBroni();

                }
                if (weaponUpgrades[i].x < 0) {
                    weaponUpgradesToRemove.push(i);

                }
            }
            for (let i = weaponUpgradesToRemove.length - 1; i >= 0; i--) {
                weaponUpgrades.splice(weaponUpgradesToRemove[i], 1);
            }
        }

        gpuLayer.pop();
        image(gpuLayer, 0, 0);
        
        // --- ZUNIFIKOWANA LOGIKA POCISKÓW WROGA (Niebieskie i Zielone kulki) ---
        if (enemyBullets.length > 0) {
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                let b = enemyBullets[i];
                b.update();
                b.show();

                // 1. Sprawdzenie, czy pocisk opuścił ekran w bezpieczny sposób
                let isOut = false;
                if (typeof b.isOffScreen === 'function') {
                    isOut = b.isOffScreen(); // Dla nowych laserów (zielone kulki)
                } else {
                    isOut = b.x < 0; // Dla starych pocisków (niebieskie kulki)
                }

                // 2. Usunięcie pocisku (wyleciał za ekran lub zdetonował)
                if (isOut || b.exploded) {
                    enemyBullets.splice(i, 1);
                } 
                // 3. Sprawdzenie kolizji TYLKO dla starych pocisków (niebieskie kulki)
                // Nowe lasery (zielone kulki) robią to we własnym pliku w funkcji update()
                else if (typeof b.hits === 'function' && b.hits(player) && !player.isImmortal) {
                    player.takeDamage(15);
                    if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety(); 
                    enemyBullets.splice(i, 1);

                    
                    if (player.shieldPower <= 0) {
                        player.startExplosion();

                    }
                }
            }
        }

        if (!isPaused) {
            spawnTimer--;
            weaponUpgradeSpawnTimer--;
            if (spawnTimer <= 0) {
                spawnRandomSphere();
                spawnTimer = 500;

            }
            if (weaponUpgradeSpawnTimer <= 0 && weaponUpgrades.length === 0) {
                let spawnX = width;
                let spawnY = random(0, height);
                if (cave && !cave.isPointInCorridor(spawnX, spawnY)) {
                    let topY = cave.topWalls.find(w => w.x <= spawnX).y;
                    let bottomY = cave.bottomWalls.find(w => w.x <= spawnX).y;
                    spawnY = random(topY, bottomY);
                }
                weaponUpgrades.push(new WeaponUpgrade(spawnX, spawnY));
                weaponUpgradeSpawnTimer = 1000;

            }
        }
        if (!isPaused) {
            // ... (logika timera)
        }
        // ZMIANA: Przekazujemy obiekt zarządzający przeszkodami (cave lub currentLevel)
        let levelController = cave || currentLevel;
        fireController.update(isPaused, levelController, gpuLayer);
        image(gpuLayer, 0, 0); // doklejenie warstwy GPU pocisków (shadery) na canvas 2D

        gpuLayer.clear();
        gpuLayer.push();
        gpuLayer.translate(-gpuLayer.width / 2, -gpuLayer.height / 2, 0);
        bombMechanics.update(cave, gpuLayer);
        gpuLayer.pop();
        image(gpuLayer, 0, 0);
        textSize(0.0146 * width);
        fill(255);
        textAlign(LEFT);
        text(`Pilot: ${playerName}`, 0.0156 * width, 0.0365 * height);
        text(bombMechanics.getBombSymbols(), 0.0156 * width, 0.0615 * height);
        text(`Broń: Poziom ${player.weaponLevel}`, 0.0156 * width, 0.0865 * height);
        textAlign(RIGHT);
        text(`Wynik: ${score}`, width - 0.0156 * width, 0.0365 * height);
        text(`Poziom: ${level}`, width - 0.0156 * width, 0.0615 * height);
        textAlign(CENTER);
        text("Moc tarczy", width / 2, 0.0365 * height);
        // Nowy licznik Astronautów w 1/4 ekranu od prawej
        textAlign(RIGHT);
        let astronautText = `👩‍🚀 ${astronautCount}`;
        let astronautX = width - (width / 4); // 1/4 od prawej strony
        if (astronautCount === 20) {
            fill(0, 255, 0); // Zielony kolor przy 20
            for (let i = 0; i < 5; i++) {
                let alpha = map(i, 0, 4, 100, 0); // Poświata
                fill(0, 255, 0, alpha);
                text(astronautText, astronautX - 0.0156 * width, 0.0615 * height + i * 0.5);
            }
        } else {
            fill(255); // Biały kolor dla reszty
            text(astronautText, astronautX - 0.0156 * width, 0.0615 * height);
        }
        fill(0, 150, 255);
        let shieldBarWidth = 0.14 * width * (player.shieldPower / 100);
        rect(width / 2 - 0.07 * width, 0.0739 * height, shieldBarWidth, 0.008 * height);
        textAlign(LEFT);
        try {
            player.update();
            gpuLayer.clear();
            gpuLayer.push();
            gpuLayer.translate(-gpuLayer.width / 2, -gpuLayer.height / 2, 0);
            player.show(gpuLayer); // Renderowanie rakiety w stanie playing
            gpuLayer.pop();
            image(gpuLayer, 0, 0); // doklejenie warstwy GPU rakiety (shadery) na canvas 2D
        } catch (e) {
            console.error("Błąd w aktualizacji gracza:", e);
            gameState = 'gameOver';
        }
        if (player.explosionFrame <= 0 && player.shieldPower <= 0 && gameState === 'playing') {
            gameState = 'gameOver';
            gameOverTimer = 60;
            saveHighScore();

        }

    } else if (gameState === 'gameOver') {
        showFotoCrashScreen();
    } else if (gameState === 'scoreScreen') {
        showGameOverScreen();
    } else if (gameState === 'win') {
        showWinScreen();
    } else if (gameState === 'kraksa') {
    }
}

function keyPressed() {
  if (gameState === 'start') {
    handleStartKeyPress();
  } else if (gameState === 'nameInput') {
    handleNameInputKeyPress();
  } else if (gameState === 'playing') {

    // ⭐ NOWA LOGIKA: START DŹWIĘKU UNIWERSALNEGO PRZY RUCHU RAKIETY ⭐
    if (!isPaused) {
        // Sprawdź, czy naciśnięto którąkolwiek ze strzałek
        if ((keyCode === UP_ARROW || keyCode === DOWN_ARROW || keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) && !universalSoundIsPlaying) {
            
            if (typeof playSoundRuchStatkuUniwersalny === 'function') {
                playSoundRuchStatkuUniwersalny(true);
                universalSoundIsPlaying = true;

            }
        }
    }
    // ⭐ KONIEC NOWEJ LOGIKI ⭐

    if (keyCode === ESCAPE) {
      isPaused = !isPaused;
      if (isPaused) {
        noLoop();

      } else {
        loop();
        redraw();

      }
    }
    if ((key === 'F' || key === 'f') && !isPaused) {
      let fs = fullscreen();
      fullscreen(!fs);
      resizeCanvas(windowWidth, windowHeight);
      if (gpuLayer) {
        gpuLayer.resizeCanvas(windowWidth, windowHeight);
      }
      redraw();

    }
    if (keyCode === 32 && !isPaused) {
      // DODAJEMY WARUNEK ABY GRA PRZERWAŁA STRZELANIE GDY RAKIETA WYBUCHŁA: && player.isActive()
      if (player.isActive()) {
        fireController.handleKeyPressed(keyCode, isPaused);
      }
    }
    if (keyCode === 86 && !isPaused) {
      fireController.handleKeyPressed(keyCode, isPaused);
    }
    if (key.toUpperCase() === 'B' && !isPaused) {
      player.useBomb();
    }
    // ------------------------------------------------------------------
    // NOWA LOGIKA: ZMIANA BRONI (N/M)
    // ------------------------------------------------------------------
    if (!isPaused) {
      let newLevel;
      let shouldChange = false;

      // Klawisz N/n (Poprzednia broń)
      if (key === 'n' || key === 'N') {
        // Oblicz poprzedni poziom. Użyj pętli, aby przejść z 1 na maxLevel i odwrotnie
        newLevel = player.weaponLevel - 1;
        if (newLevel < 1) {
          newLevel = player.maxWeaponLevel; // Przewinięcie na koniec
        }
        shouldChange = true;
      } 
      // Klawisz M/m (Następna broń)
      else if (key === 'm' || key === 'M') {
        // Oblicz następny poziom. Użyj pętli, aby przejść z maxLevel na 1
        newLevel = player.weaponLevel + 1;
        if (newLevel > player.maxWeaponLevel) {
          newLevel = 1; // Przewinięcie na początek
        }
        shouldChange = true;
      }

      if (shouldChange && newLevel >= 1 && newLevel <= player.maxWeaponLevel) {
        // Zmień tylko, jeśli nowy poziom jest odblokowany (player.maxWeaponLevel)
        player.weaponLevel = newLevel;
        // Wymagamy metody w FireController do poinformowania go o zmianie
        if (typeof fireController !== 'undefined' && fireController.updateWeaponLevel) {
           fireController.updateWeaponLevel(player.weaponLevel);
        }

      }
    }
  } else if (gameState === 'gameOver' || gameState === 'scoreScreen' || gameState === 'win') {
    handleEndScreensKeyPress(); // <-- ZMIANA: Wywołanie nowej, ujednoliconej funkcji
  }
}

function keyReleased() {
  if (gameState === 'playing' && keyCode === 32) {
    fireController.handleKeyReleased(keyCode);
  }
}

function keyTyped() {
  if (gameState === 'nameInput') {
    handleNameInputKeyTyped();
  }
}

function resetGame() {
  player = new Player();
  fireController = new FireController(player);
  enemies = [];
  humanoids = [];
  shieldBoosts = [];
  immortalityBoosts = [];
  keys = [];
  weaponUpgrades = [];
  enemyBullets = [];
  cave = null;
  score = 0;
  level = 1;
  isPaused = false;
  spawnTimer = 500;
  caveTimer = 0;
  gameOverTimer = 0;
  weaponUpgradeSpawnTimer = 1000;
  bombMechanics.resetBombs();
  astronautCount = 0; // Reset licznika Astronautów
  spawnLevel();

}

function resetGameFromLevel() {
  player = new Player();
  fireController = new FireController(player);
  enemies = [];
  humanoids = [];
  shieldBoosts = [];
  immortalityBoosts = [];
  keys = [];
  weaponUpgrades = [];
  enemyBullets = [];
  cave = null;
  score = 0;
  isPaused = false;
  spawnTimer = 500;
  caveTimer = 0;
  gameOverTimer = 0;
  weaponUpgradeSpawnTimer = 1000;
  bombMechanics.resetBombs();
  astronautCount = 0; // Reset licznika Astronautów
  spawnLevel();

}

function resetGameFromStart() {
  player = new Player();
  fireController = new FireController(player);
  enemies = [];
  humanoids = [];
  shieldBoosts = [];
  immortalityBoosts = [];
  keys = [];
  weaponUpgrades = [];
  enemyBullets = [];
  cave = null;
  score = 0;
  level = 1;
  isPaused = false;
  spawnTimer = 500;
  caveTimer = 0;
  gameOverTimer = 0;
  weaponUpgradeSpawnTimer = 1000;
  bombMechanics.resetBombs();
  astronautCount = 0; // Reset licznika Astronautów
  spawnLevel();

}

function rectRectCollision(rect1x, rect1y, rect1w, rect1h, rect2x, rect2y, rect2w, rect2h) {
  return rect1x < rect2x + rect2w &&
         rect1x + rect1w > rect2x &&
         rect1y < rect2y + rect2h &&
         rect1y + rect1h > rect2y;
}

function rectCircleCollision(rectX, rectY, rectW, rectH, circleX, circleY, circleR) {
  let closestX = max(rectX, min(circleX, rectX + rectW));
  let closestY = max(rectY, min(circleY, rectY + rectH));
  let distanceX = circleX - closestX;
  let distanceY = circleY - closestY;
  return (distanceX * distanceX + distanceY * distanceY) < (circleR * circleR);
}

function circleCircleCollision(x1, y1, r1, x2, y2, r2) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let distance = sqrt(dx * dx + dy * dy);
  return distance < (r1 + r2);
}

function spawnRandomSphere() {
  let rand = random();
  let spawnX = width;
  let spawnY = random(0, height);
  if (cave && !cave.isPointInCorridor(spawnX, spawnY)) {
    let topY = cave.topWalls.find(w => w.x <= spawnX).y;
    let bottomY = cave.bottomWalls.find(w => w.x <= spawnX).y;
    spawnY = random(topY, bottomY);
  }
  if (rand < 0.4) { // Zwiększono z 0.2 do 0.4, aby podwoić szansę na BombBoost (40%)
    window.bombBoosts.push(new BombBoost(spawnX, spawnY));

  } else if (rand < 0.6) { // Zmniejszono z 0.4 do 0.6, aby zachować 20% dla Humanoid
    humanoids.push(new Humanoid(spawnX, spawnY));

  } else if (rand < 0.8) { // Zmniejszono z 0.6 do 0.8, aby zachować 20% dla ShieldBoost
    shieldBoosts.push(new ShieldBoost(spawnX, spawnY));

  } else if (rand < 0.9) { // Zmniejszono z 0.8 do 0.9, aby zachować 10% dla ImmortalityBoost
    immortalityBoosts.push(new ImmortalityBoost(spawnX, spawnY));

  }
}

function spawnLevel() {
  enemies = [];

  // NAPRAWA: pociski wrogów z POPRZEDNIEGO poziomu nie były czyszczone przy
  // zmianie poziomu (czyszczono je tylko przy pełnym resecie gry). Mogły
  // więc "przelecieć" do nowego poziomu i trafić gracza tuż po starcie,
  // mimo że wizualnie nie miały już tam prawa się pojawić.
  enemyBullets = [];

  // Krążownik będzie pojawiał się tylko na poziomach kończących się na 9 (19, 29, 39...)
  if (level % 10 === 8) {
    let spawnX = (width + 300); // krążownik będzie się pojawiał 300 pikseli za prawą krawędzią ekranu
    let spawnY = random(0.2 * height, 0.8 * height); // Dodałem lekki margines od góry i dołu

    keys.push(new Key(spawnX, spawnY));
  }

  // --- LOGIKA POZIOMÓW ---

  if (level >= 1 && level <= 9 && typeof Level1_9 !== 'undefined') {
    currentLevel = new Level1_9();
    enemies = currentLevel.enemies;
  }
  else if (level === 10 && typeof Level10 !== 'undefined') {
    enemies = []; // WYMUSZONE CZYSZCZENIE
    obstacles = [];       // DODAJ TO: Czyścimy przeszkody z poprzednich poziomów
    currentLevel = null; // ODCIĘCIE POPRZEDNIEGO POZIOMU
    cave = new Level10();
    caveTimer = 7200;
  }
  else if (level >= 11 && level <= 19 && typeof Level11_19 !== 'undefined') {
    enemies = []; // WYMUSZONE CZYSZCZENIE
    currentLevel = null; // ODCIĘCIE POPRZEDNIEGO POZIOMU
    currentLevel = new Level11_19();
    enemies = currentLevel.enemies;
  }
  else if (level === 20 && typeof Level20 !== 'undefined') {
    enemies = []; // WYMUSZONE CZYSZCZENIE
    currentLevel = null; // ODCIĘCIE POPRZEDNIEGO POZIOMU
    cave = new Level20();
    caveTimer = 99999;
  }
  else if (level >= 21 && level <= 29 && typeof Level21_29 !== 'undefined') {
    enemies = []; // WYMUSZONE CZYSZCZENIE
    currentLevel = null; // ODCIĘCIE POPRZEDNIEGO POZIOMU
    currentLevel = new Level21_29();
    enemies = currentLevel.enemies;

  }
  else if (level === 30 && typeof Level30 !== 'undefined') {
    currentLevel = new Level30();
    asteroids = currentLevel.asteroids; // Używamy nowej tablicy asteroids
    enemies = []; // Ważne: usuwamy wszystkich wrogów na tym poziomie

  }
  else if (level >= 31 && level <= 39 && typeof Level31_39 !== 'undefined') {
    enemies = []; // WYMUSZONE CZYSZCZENIE
    currentLevel = null; // ODCIĘCIE POPRZEDNIEGO POZIOMU
    currentLevel = new Level31_39();
    enemies = currentLevel.enemies;

  }
  else if (level === 40 && typeof Level40 !== 'undefined') {
    enemies = []; // WYMUSZONE CZYSZCZENIE
    currentLevel = null; // ODCIĘCIE POPRZEDNIEGO POZIOMU
    cave = new Level40();
    caveTimer = 7200;

  }
  else { 
    // Ten kod wykona się, jeśli 'level' nie pasuje do żadnego z wcześniej zdefiniowanych poziomów (np. 31, 32, 101)
    
    gameState = 'win';

    // ⭐ MODYFIKACJA: Wyłączenie dźwięku po wygranej
    if (typeof playSoundRuchStatkuUniwersalny === 'function') {
        playSoundRuchStatkuUniwersalny(false); 
    }
    // ⭐ NOWA LINIA: Musimy też zresetować flagę dla nowej gry
    if (typeof universalSoundIsPlaying !== 'undefined') { 
        universalSoundIsPlaying = false; 
    }



  }
}

function startTestLevel(targetLevel) {
  resetGame();
  level = targetLevel;
  gameState = 'nameInput';
  inputText = 'TestPilot';
  playerName = 'TestPilot';

  setTimeout(() => {
    gameState = 'playing';
    spawnLevel();
    loop();
  }, 100);
}