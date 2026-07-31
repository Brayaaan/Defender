/**
 * Plik: src/levels/level_31-39.js
 * Opis: Definicje poziomów od 31 do 39.
 * ⭐ NOWA WERSJA: Tworzy jeden skryptowany łańcuch 10 wrogów.
 */
class Level31_39 {  
  constructor() {  
    this.enemies = [];  
    this.levelTimer = 0; // konieczne do synchronizacji
    // ⭐ WYWOŁANIE NOWEJ FUNKCJI TWORZENIA ŁAŃCUCHA ⭐
    this.generateChain(); 
 
  }
  
  generateChain() {
    const chainSize = 10;
    const spawnDelayIncrement = 20; // Opóźnienie między kolejnymi wrogami w łańcuchu
    
    // Wlot w losowej części wysokości prawej strony ekranu (np. 1/3 do 2/3 wysokości)
    const randomStartY = random(height * 0.3, height * 0.7);

    for (let i = 0; i < chainSize; i++) {  
      // Tworzymy wroga, przekazując: indeks, rozmiar łańcucha, losowy Y i opóźnienie
      const enemy = new Enemy_grupa1(i, chainSize, randomStartY, i * spawnDelayIncrement);
      this.enemies.push(enemy);  
  
    }  
 
  }

  update(player, enemyBullets) {
    this.levelTimer++; // licznik poziomu
    
    // Upewnij się, że player.bullets istnieje
    if (!player.bullets || !Array.isArray(player.bullets)) {  
      player.bullets = [];  
    }
    
    for (let i = this.enemies.length - 1; i >= 0; i--) {  
      let enemy = this.enemies[i];  
      if (!enemy) continue; 
      
      // Aktualizacja wroga
      enemy.update(player, this.levelTimer, enemyBullets); 
      
      // KOLIZJA WROG-GRACZ
      if (enemy.explosionFrame <= 0 && enemy.hits(player) && !player.isImmortal) {
          enemy.handleCollision(player);
      }

      // Kolizje pocisków gracza z wrogiem: najpierw tarcza, potem HP
      for (let j = player.bullets.length - 1; j >= 0; j--) {
        let bullet = player.bullets[j];
        if (!bullet) continue;
        if (enemy.hitByBullet(bullet)) {
          // usuń pocisk od razu
          player.bullets.splice(j, 1);

          // 1) Jeśli tarcza aktywna, zadaj obrażenia tarczy
          if (enemy.shieldHP > 0) {
            // wartość obrażeń tarczy na pocisk -- możesz dopasować
            const SHIELD_DAMAGE_PER_BULLET = 10;
            const shieldDestroyed = enemy.applyShieldDamage(SHIELD_DAMAGE_PER_BULLET, bullet.x, bullet.y);
            // jeśli zniszczona, dalsze zachowanie obsłuży poniżej
            if (shieldDestroyed) {
              // Tarczę zniszczono - opcjonalnie daj krótki efekt (już robione w applyShieldDamage)
              // Nie obcinaj życia dodatkowo tym samym pociskiem (zachowanie: tarcza pochłania pocisk)
            }
          } else {
            // 2) brak tarczy -> zadaj obrażenia bezpośrednio wrogowi
            const DAMAGE_TO_ENEMY = 1; // przykład: 1 HP na pocisk
            if (enemy.takeDamage(DAMAGE_TO_ENEMY)) {
              // wróg umarł - dodaj punkty
              score += enemy.points;
            }
          }
        }
      }
    }
    
    // Zarządzanie pociskami wrogów (pozostałe z Twojego kodu)
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
    
    // Usunięcie wrogów po eksplozji
    this.enemies = this.enemies.filter(enemy => !(enemy.explosionFrame <= 0 && enemy.exploded));  
    
  }

  show() {  
    for (let enemy of this.enemies) {  
      if (enemy) enemy.show();  
    }  
  }  
  
  isLevelComplete() {  
  // Poziom kończy się tylko, gdy nie ma wrogów i nie ma już żadnych pocisków w locie
    return this.enemies.length === 0 && enemyBullets.length === 0;  
  } 
}
