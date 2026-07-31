class Level30 {
  constructor() {
    this.bats = []; 
    this.asteroids = []; // Zamiast enemies, mamy asteroids
    // ⭐ 1. DODANE: Inicjalizacja tablicy na iskry
    this.sparkParticles = []; 

    this.enemies = [];
    this.levelTimer = 0; 
    this.spawnTimer = 0; 

    this.setNextSpawnTime();
  }

  setNextSpawnTime() {
    // Losowy odstęp: 200, 300 lub 400 klatek
    const intervals = [200, 300, 400];
    this.spawnTimer = random(intervals);
  }

  spawnAsteroidWave() {
    // Losowo 2, 3 lub 4 asteroidy
    const numAsteroids = floor(random(2, 5));
    
    for (let i = 0; i < numAsteroids; i++) {
      // Losowa pozycja Y na prawej krawędzi
      let y = random(0, height);
      // Duża asteroida (size=3)
      this.asteroids.push(new Asteroid(width + 150, y, 3));
    }

  }

  update(player) {
    this.levelTimer++;

    // FAZA 1: Wstęp (300 klatek)
    if (this.levelTimer <= 300) {
      return; 
    }

    // FAZA 2: Generowanie i zarządzanie asteroidami
    this.spawnTimer--;

    if (this.spawnTimer <= 0) {
      this.spawnAsteroidWave();
      this.setNextSpawnTime(); // Ustawienie następnego interwału
    }

    let newAsteroids = [];
    
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      let asteroid = this.asteroids[i];
      
      asteroid.update();

      // 1. Kolizja z graczem
      if (asteroid.hits(player) && !player.isImmortal && asteroid.explosionFrame <= 0) {
        
        // 1. ODLICZENIE PUNKTÓW Z TARCZY
        player.takeDamage(20); 

        // 2. ODBICIE RAKIETY O 30 PIKSELI W LEWO
        const ODBICIE_X = 30;
        player.x -= ODBICIE_X;

        // Opcjonalne zabezpieczenie
        if (player.x < 0) {
          player.x = 0;
        }

        // 3. ODTWARZANIE DŹWIĘKU KOLIZJI
        playSoundKolizjaRakiety(); 
      }
      
      // 2. Zniknięcie asteroidy z lewej strony
      if (asteroid.x < -asteroid.radius) {
        this.asteroids.splice(i, 1);
        continue;
      }
      
      // 3. Kolizja z pociskami gracza
      for (let j = player.bullets.length - 1; j >= 0; j--) {
        let bullet = player.bullets[j];
        
        if (asteroid.hitByBullet(bullet) && asteroid.explosionFrame <= 0) {
          
          // ⭐ 2. DODANE: Generowanie iskier w miejscu uderzenia
          this.spawnSparks(bullet.x, bullet.y); 
          
          player.bullets.splice(j, 1); // Usuń pocisk
          playSoundTrafieniewPrzeszkode(); // Dźwięk trafienia w przeszkodę
          
          if (asteroid.takeDamage(bullet.damage)) {
            // Jeśli asteroida została zniszczona, podziel ją
            playSoundPekniecieAsteroidy();
            let splitResults = asteroid.split();
            if (splitResults.length > 0) {
              newAsteroids.push(...splitResults);
            }
            // Usuń zniszczoną asteroidę później, jeśli wybuch dobiegł końca
          }
          break;
        }
      }
      
      // 4. Usuwanie po wybuchu
      if (asteroid.exploded && asteroid.explosionFrame <= 0) {
        this.asteroids.splice(i, 1);
      }
    }
    
    // Dodanie nowo utworzonych asteroid do głównej tablicy
    this.asteroids.push(...newAsteroids);
    
    // ⭐ 3. DODANE: Aktualizacja iskier
    this.updateSparks(); 
  }

  // ⭐ 4. DODANA METODA: Generowanie iskier w punkcie uderzenia
  spawnSparks(x, y) {
    const NUM_SPARKS = floor(random(5, 8));
    for (let i = 0; i < NUM_SPARKS; i++) {
      // Wywołanie klasy Spark, która musi być zdefiniowana globalnie
      this.sparkParticles.push(new Spark(x, y)); 
    }
  }

  // ⭐ 5. DODANA METODA: Aktualizacja i czyszczenie
  updateSparks() {
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      this.sparkParticles[i].update();
      if (this.sparkParticles[i].lifespan <= 0) {
        this.sparkParticles.splice(i, 1);
      }
    }
  }

  isLevelComplete() {
    // Poziom trwa 1500 klatek (ok. 25 sekund przy 60 FPS)
    const LEVEL_DURATION = 1500;
    
    // Poziom jest ukończony, jeśli minął czas ORAZ
    // nie ma już żadnych asteroid na ekranie.
    return this.levelTimer > LEVEL_DURATION && this.asteroids.length === 0;
  }

  // pg = warstwa p5.Graphics w trybie WEBGL, przekazana z game.js (currentLevel.show(gpuLayer))
  show(pg) {
    // Rysowanie asteroid
    for (let asteroid of this.asteroids) {
      asteroid.show(pg);
    }
    
    // ⭐ 6. DODANE: Rysowanie iskier
    for (let spark of this.sparkParticles) {
      spark.show();
    }
  }
}
