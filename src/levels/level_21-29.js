class Level21_29 {
  constructor() {
    this.enemies = [];

    // Generuj zwykłe czerwone kulki tylko na poziomach od 21 do 28
    if (typeof level !== 'undefined' && level < 29) {
      this.generateEnemies();
    }

    // Na poziomie 29 pojawia się tylko Boss 3
    if (typeof level !== 'undefined' && level === 29) {
      this.enemies.push(new Boss3_HydraNerwowa());
    }
  }

  generateEnemies() {
    let numEnemies = 10; // Stała liczba wrogów na poziom
    for (let i = 0; i < numEnemies; i++) {
      this.enemies.push(new Enemy3_czerwone_kulki());
    }
  }

  update(player, enemyBullets) {
    if (!player.bullets || !Array.isArray(player.bullets)) {
      player.bullets = []; // Inicjalizacja, jeśli nie istnieje
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      let enemy = this.enemies[i];
      if (!enemy) continue; // Zabezpieczenie przed undefined

      // 1. Rozróżnienie aktualizacji w zależności od typu wroga
      if (enemy.constructor.name === 'Boss3_HydraNerwowa') {
        
        enemy.update(player); 

        // Kolizje bezpośrednie korpusu z rakietą
        if (enemy.hits(player) && !player.isImmortal) {
          enemy.handleCollision(player); 
        }

        // Przejmowanie wyklutych Czerwonych Kulek z macek
        if (enemy.spawnQueue && enemy.spawnQueue.length > 0) {
          this.enemies.push(...enemy.spawnQueue);
          enemy.spawnQueue = []; 
        }

        // UWAGA: Całkowicie usunięto stąd instrukcję this.enemies.splice(i, 1).
        // Obiekt Bossa 3 musi pozostać w pamięci poziomu do końca wybuchu atomówki, 
        // dokładnie tak samo jak Matriarka w poziomie 9!

      } else {
        // Logika dla zwykłych czerwonych kulek
        enemy.update(enemyBullets);
        if (enemy.explosionFrame <= 0 && enemy.hits(player) && !player.isImmortal) {
          enemy.handleCollision(player); 
        }
        
        // Sprawdzenie obrażeń i eksplozji
        for (let bullet of player.bullets) {
          if (enemy.hitByBullet(bullet)) {
            enemy.health--;
            if (enemy.health <= 0 && !enemy.exploded) {
              enemy.startExplosion();
              enemy.exploded = true;
              score += enemy.points;

              let bulletIndex = player.bullets.indexOf(bullet);
              if (bulletIndex !== -1) player.bullets.splice(bulletIndex, 1); 
            }
          }
        }
      }
    }

    // Zarządzanie pociskami wrogów
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      let bullet = enemyBullets[i];
      bullet.update();
      bullet.show();
      if (bullet.x < 0) {
        enemyBullets.splice(i, 1);
      } else if (bullet.hits(player) && !player.isImmortal) {
        player.takeDamage(15);
        enemyBullets.splice(i, 1);

        if (player.shieldPower <= 0) {
          player.startExplosion();
        }
      }
    }
    // Usunięcie wrogów po eksplozji (bezpieczne filtry dla kulek)
    this.enemies = this.enemies.filter(enemy => !(enemy.explosionFrame <= 0 && enemy.exploded));
  }

  show() {
    for (let enemy of this.enemies) {
      if (enemy) enemy.show(); // Zabezpieczenie przed undefined
    }
  }

  isLevelComplete() {
    // Wzorowane na poziomie 9: Poziom kończy się, gdy w tablicy wrogów
    // nie ma już żywych obiektów, a ewentualny boss zakończył wybuch i jest martwy
    if (this.enemies.length === 1 && this.enemies[0].constructor.name === 'Boss3_HydraNerwowa') {
      return this.enemies[0].isDead && this.enemies[0].explosionFrame <= 0;
    }
  // Poziom kończy się tylko, gdy nie ma wrogów i nie ma już żadnych pocisków w locie
    return this.enemies.length === 0 && enemyBullets.length === 0;
  }
}