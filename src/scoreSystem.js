// Globalna zmienna punktacji
let score = 0;

class ScoringSystem {
  takeDamage(enemy, damage) {
    if (!enemy.health) enemy.health = this.enemyHealth[enemy.constructor.name.toLowerCase()] || 1;
    enemy.health -= damage;
    if (enemy.health <= 0) {
      this.awardPoints(enemy);
      return true; // Wróg zniszczony
    }
    return false;
  }
  applyBombBlast(enemies, blastRadius, playerX, playerY) {
    for (let enemy of enemies) {
      let dx = enemy.x - playerX;
      let dy = enemy.y - playerY;
      let distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= blastRadius) {
        if (!enemy.explosionFrame && !enemy.exploded) { // Unikanie podwójnego naliczania
          this.takeDamage(enemy, enemy.health); // Zabija wroga natychmiast
        }
      }
    }
  }
}

const scoringSystem = new ScoringSystem();