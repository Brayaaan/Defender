// ---------------------------------------------------------------------------
// Wspólny vertex shader dla statku
// ---------------------------------------------------------------------------
const ENEMY_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

// ---------------------------------------------------------------------------
// Zaawansowany shader statku (Zaktualizowany: Niebiesko-Czerwony + Błękitny ogień)
// ---------------------------------------------------------------------------
const ENEMY_FRAG_SRC = `precision highp float;
varying vec2 vTexCoord;

uniform float uTime;
uniform float uExplosion; // od 0.0 (żywy) do 1.0 (całkowity wybuch)
uniform float uShield;    // 1.0 jeśli tarcza aktywna
uniform float uChasing;   // 1.0 jeśli goni
uniform float uHitFlash;  // intensywność błysku tarczy (od 0.0 do 1.0)
uniform vec2 uHitPos;     // znormalizowana pozycja uderzenia w tarczę

// Funkcje szumu
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float f = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
  return f;
}

// --- Geometria poszczególnych elementów statku (SDF) ---
float dHull(vec2 p) {
  // Główny niebieski kadłub (płaski tył, szpiczasty przód)
  float front = -p.x + abs(p.y) * 1.4 - 0.6; 
  float back = p.x - 0.35;
  float sides = abs(p.y) - 0.22 - p.x * 0.1;
  return max(max(front, back), sides);
}

float dWings(vec2 p) {
  // Ciemnoczerwone skrzydła skośne
  vec2 wp = vec2(p.x - 0.25, abs(p.y) - 0.3);
  float wingShape = max(abs(wp.x - wp.y * 1.0) - 0.2, abs(wp.y) - 0.25);
  // Odcięcie przodu, aby nie wystawały przed kadłub
  return max(wingShape, -p.x + 0.1); 
}

float dRhombus(vec2 p) {
  // Wewnętrzny czerwony romb
  return abs(p.x + 0.1) * 1.2 + abs(p.y) * 2.5 - 0.3;
}

float dCockpit(vec2 p) {
  // Brązowa kabina pilota
  return length(vec2((p.x + 0.05) * 1.5, p.y * 2.5)) - 0.08;
}

float dNozzle(vec2 p) {
  // Brązowa dysza z tyłu
  return length(vec2((p.x - 0.4) * 2.0, p.y * 1.5)) - 0.12;
}

// Suma wszystkich brył statku
float sdShip(vec2 p) {
  return min(min(min(min(dHull(p), dWings(p)), dNozzle(p)), dRhombus(p)), dCockpit(p));
}

void main() {
  vec2 uv = (vTexCoord - 0.5) * 2.0; 
  vec4 finalColor = vec4(0.0);
  float dist = length(uv);

  // --- 1. TARCZA ENERGETYCZNA ---
  if (uShield > 0.0 && uExplosion == 0.0) {
    float shieldEdge = smoothstep(0.85, 0.95, dist) - smoothstep(0.95, 1.0, dist);
    float shieldCore = fbm(uv * 5.0 + uTime) * 0.2 * smoothstep(1.0, 0.5, dist);
    vec3 shieldCol = vec3(0.1, 0.5, 1.0) * (shieldEdge * 1.5 + shieldCore);
    
    if (uHitFlash > 0.0) {
      float hitDist = length(uv - uHitPos);
      float flash = smoothstep(0.4, 0.0, hitDist) * uHitFlash;
      shieldCol += vec3(0.5, 0.8, 1.0) * flash * 2.0;
    }
    finalColor += vec4(shieldCol, shieldEdge + shieldCore + (uHitFlash * 0.5));
  }

  // --- 2. BUDOWA STATKU I KOLORY ---
  float dS = sdShip(uv);
  float isHull = 1.0 - smoothstep(0.0, 0.02, dS);

  // Generowanie masek (gdzie co ma być pomalowane)
  float mWings   = 1.0 - smoothstep(0.0, 0.015, dWings(uv));
  float mNozzle  = 1.0 - smoothstep(0.0, 0.015, dNozzle(uv));
  float mHull    = 1.0 - smoothstep(0.0, 0.015, dHull(uv));
  float mRhombus = 1.0 - smoothstep(0.0, 0.015, dRhombus(uv));
  float mCockpit = 1.0 - smoothstep(0.0, 0.015, dCockpit(uv));

  // Paleta kolorów
  vec3 colWings   = vec3(0.39, 0.08, 0.12); // Bordowy / Ciemny czerwony
  vec3 colNozzle  = vec3(0.35, 0.21, 0.12); // Brąz
  vec3 colHull    = vec3(0.08, 0.23, 0.55); // Nasycony niebieski
  vec3 colRhombus = vec3(0.70, 0.12, 0.15); // Wyrazisty czerwony
  vec3 colCockpit = vec3(0.23, 0.15, 0.12); // Ciemny brąz

  // Kompozycja kolorów statku warstwowo
  vec3 shipColor = vec3(0.0);
  shipColor = mix(shipColor, colWings, mWings);
  shipColor = mix(shipColor, colNozzle, mNozzle);
  shipColor = mix(shipColor, colHull, mHull);
  shipColor = mix(shipColor, colRhombus, mRhombus);
  shipColor = mix(shipColor, colCockpit, mCockpit);

  // Delikatny szum/zabrudzenia na całej bryle
  float pattern = fbm(uv * 12.0) * 0.25;
  shipColor += vec3(pattern) * isHull;

  // Podświetlenie krawędzi dla efektu przestrzennego
  float rim = smoothstep(-0.1, 0.0, dS);
  shipColor += vec3(0.3, 0.5, 0.7) * rim * 0.4 * isHull;

  // Iskrzenie podczas pościgu (zostawiamy delikatny akcent)
  if (uChasing > 0.0 && uExplosion == 0.0) {
    float chaseGlow = fbm(uv * 15.0 - uTime * 5.0);
    float engineActive = smoothstep(0.3, 1.0, chaseGlow) * isHull;
    shipColor += vec3(1.0, 0.9, 0.0) * engineActive * 0.8;
  }

  // --- 3. LOGIKA WYBUCHU ORAZ GAZY WYLOTOWE ---
  if (uExplosion > 0.0) {
    // Cyfrowy rozpad statku
    float dissolveNoise = fbm(uv * 8.0 - uTime * 2.0);
    float dissolveFactor = smoothstep(uExplosion - 0.2, uExplosion + 0.1, dissolveNoise);
    vec3 explBright = vec3(0.0, 0.8, 1.0); 
    
    if (isHull > 0.0) {
      vec3 dissolveColor = mix(explBright, shipColor, dissolveFactor);
      finalColor += vec4(dissolveColor * isHull, isHull * dissolveFactor);
    }
    
    // Cząsteczki rozrzucone obok pancerza
    float particleNoise = fbm(uv * 20.0 + uTime * 4.0);
    float sparks = smoothstep(0.85, 1.0, particleNoise) * smoothstep(1.0, 0.5, uExplosion);
    if (dist < uExplosion * 1.5) { 
       finalColor += vec4(explBright * sparks * 2.0, sparks);
    }
  } else {
    // Rysowanie żywego statku
    finalColor = mix(finalColor, vec4(shipColor, 1.0), isHull);
    
    // Niezależne błękitne płomienie wylotowe wychodzące poza obrys statku (uv.x > 0.3)
    if (uv.x > 0.3) {
       float engineGlow = fbm(uv * 15.0 - vec2(uTime * 15.0, 0.0));
       float thruster = smoothstep(0.9, 0.3, uv.x) * smoothstep(0.15, 0.0, abs(uv.y));
       float flameAlpha = thruster * engineGlow;
       
       // Zewnętrzna chmura plazmy
       vec3 flameCol = vec3(0.0, 0.7, 1.0) * flameAlpha * 2.5; 
       
       // Bardzo gorący, biały rdzeń silnika tuż przy dyszy
       float core = smoothstep(0.6, 0.3, uv.x) * smoothstep(0.05, 0.0, abs(uv.y));
       flameCol += vec3(0.8, 0.9, 1.0) * core * (0.5 + 0.5 * sin(uTime * 20.0));
       
       // Dodanie ognia z przezroczystością na tło i kadłub
       finalColor += vec4(flameCol, flameAlpha * 0.8);
    }
  }

  gl_FragColor = finalColor;
}`;




/**
 * Plik: src/enemies/enemies_grupa1.js
 * Opis: Wróg typu "Łańcuch-Półkole-Strzał" (Enemy_grupa1).
 * Wersja poprawiona — obsługa tarczy, efektów trafień i brakujących metod.
 */

class Enemy_grupa1 {
  static HEALTH = 30;
  static CHAIN_SHIELD_POWER = 110; // ustaw na 10/100 według potrzeby
  static FORCEFIELD_RADIUS = 70; // taki jak w drawForceField!


  constructor(index, chainSize, startY, spawnDelay) {
    // Pozycja i identyfikacja
    this.x = width;
    this.y = startY;
    this.index = index;
    this.spawnDelay = spawnDelay || 0;

    // Fazy ruchu
    this.phase = "entry"; // entry, turn, position, shoot, repelled

    // Cele ruchu
    this.targetX = width * 0.8;
    this.targetY = this.y;
    this.chainTargetX = width * 0.95;
    this.entrySpeed = 0.003 * width;
    this.turnSpeed = 0.02;

    const COLUMN_START_Y = height * 0.1;
    const COLUMN_SPACING = (height * 0.8) / Math.max(1, (chainSize - 1));
    this.finalY = COLUMN_START_Y + this.index * COLUMN_SPACING;

    // --- Pościg rakiety (nowa mechanika) ---
    this.isChasing = false;
    this.chaseTimer = floor(random(0, 300));   // 5 sekund = 300 klatek
    this.chaseDuration = 0;
    this.chaseSpeed = 0.002 * width;           // stała prędkość pościgu


    // Wymiary i żywotność
    this.radius = 36;
    this.health = Enemy_grupa1.HEALTH;

    // Tarcza (shield)
    this.shieldHP = Enemy_grupa1.CHAIN_SHIELD_POWER;
    this.shieldHitFlash = 0;
    this.shieldHitX = 0;
    this.shieldHitY = 0;

    // Punkty i eksplozja
    this.points = 15;
    this.explosionFrame = 0;
    this.explosionParticles = [];
    this.exploded = false;

    // Strzelanie
    this.shootTimer = 180;
    this.shootInterval = 120;
    this.maxShootInterval = 240;
    this.lastCollisionFrame = -Infinity;

    // Ruch po odepchnięciu
    this.repelTimer = 0;
    this.repelVelocityX = 0;
    this.repelVelocityY = 0;
    this.individualMovementX = 0;
    this.individualMovementY = 0;

    // pomocnicze
    this._lastBulletHitPos = { x: 0, y: 0 };
  }

  // Główna aktualizacja
  update(player, levelTimer, enemyBullets) {
    if (this.explosionFrame > 0) {

      // NOWE: Kontynuacja ruchu podczas anihilacji
      // Statek zachowuje swój pęd z fazy pościgu/odskoku lub standardowego lotu
      if (this.individualMovementX !== 0 || this.individualMovementY !== 0) {
        this.x += this.individualMovementX;
        this.y += this.individualMovementY;
      } else if (this.vx || this.vy) {
        this.x += (this.vx || 0);
        this.y += (this.vy || 0);
      }

      for (let p of this.explosionParticles) {
        p.x += p.vx;
        p.y += p.vy;
      }
      this.explosionFrame--;
      return;
    }

    if (this.spawnDelay > 0) {
      this.spawnDelay--;
      return;
    }

    switch (this.phase) {
      case "entry":
        this.handleEntry();
        break;
      case "turn":
        this.handleTurn();
        break;
      case "position":
        this.handlePosition();
        break;
      case "shoot":
        this.handleShooting(player, enemyBullets);
        break;
      case "repelled":
        this.handleRepelled();
        break;
    }

    if (this.phase === "entry" && this.x < -this.radius) {
      this.exploded = true;
    }
  }

  // Ruch - entry
  handleEntry() {
    const ang = atan2(this.targetY - this.y, this.targetX - this.x);
    const tvx = cos(ang) * this.entrySpeed;
    const tvy = sin(ang) * this.entrySpeed;
    this.vx = lerp(this.vx || -this.entrySpeed, tvx, this.turnSpeed);
    this.vy = lerp(this.vy || 0, tvy, this.turnSpeed);
    this.x += this.vx;
    this.y += this.vy;
    if (this.x <= this.targetX) this.phase = "turn";
  }

  // Ruch - turn (do kolumny)
  handleTurn() {
    this.targetY = this.finalY;
    this.targetX = this.chainTargetX;
    const d = dist(this.x, this.y, this.targetX, this.targetY);
    const sf = constrain(d / (width * 0.05), 0, 1);
    const spd = this.entrySpeed * 0.8 * sf;
    const ang = atan2(this.targetY - this.y, this.targetX - this.x);
    const tvx = cos(ang) * spd;
    const tvy = sin(ang) * spd;
    this.vx = lerp(this.vx || 0, tvx, this.turnSpeed * 1.5);
    this.vy = lerp(this.vy || 0, tvy, this.turnSpeed * 1.5);
    this.x += this.vx;
    this.y += this.vy;
    if (d < 1) {
      this.phase = "position";
      this.x = this.targetX;
      this.y = this.targetY;
    }
  }

  handlePosition() {
    this.x = this.chainTargetX;
    this.y = this.finalY;
    this.phase = "shoot";
    this.shootTimer = 180;
  }

  handleShooting(player, enemyBullets) {

    // =========================================
    //   TRYB POŚCIGU (działa tylko w ruchu w lewo)
    // =========================================
    if (this.individualMovementX !== 0) {

        if (this.isChasing) {
            this.chaseDuration++;
            playSoundPogon();

            // koniec pościgu po 3 sekundach
            if (this.chaseDuration >= 180) {
                this.isChasing = false;
                this.chaseDuration = 0;

                // <<< PRZYWRACANIE RUCHU W LEWO >>>
                // Wznowienie ruchu w lewo (kod z handleRepelled)
                const deg = random(150, 210); // Kąt na ruch w lewo
                const ang = radians(deg);
                const spd = 0.003 * width; // Szybkość ruchu w lewo
                this.individualMovementX = cos(ang) * spd;
                this.individualMovementY = sin(ang) * spd;
                // <<</ KLUCZOWA ZMIANA: PRZYWRACANIE RUCHU W LEWO >>>

            } else {
                // kierunek w stronę rakiety
                let angle = atan2(player.y - this.y, player.x - this.x);
                this.individualMovementX = cos(angle) * this.chaseSpeed;
                this.individualMovementY = sin(angle) * this.chaseSpeed;
            }

        } else {
            // Odliczanie do kolejnego losowania
            this.chaseTimer--;

            if (this.chaseTimer <= 0) {

                // Szansa wejścia w pościg 1/4
                if (random(1) < 0.25) {
                    this.isChasing = true;
                    this.chaseDuration = 0;
                }

                // kolejne losowanie za 5 sekund
                this.chaseTimer = 300;
            }
        }
    }


    if (this.individualMovementX !== 0) {
      this.x += this.individualMovementX;
      this.y += this.individualMovementY;
      if (this.y - this.radius < 0 || this.y + this.radius > height) {
        this.individualMovementY *= -1;
        this.y = constrain(this.y, this.radius, height - this.radius);
      }
      if (this.x < -this.radius) this.x = width + this.radius;
    } else {
      this.x = this.chainTargetX;
      this.y = this.finalY;
    }

    this.shootTimer--;
    if (this.shootTimer <= 0) {
      this.shoot(player, enemyBullets);
      this.shootTimer = floor(random(this.shootInterval, this.maxShootInterval));
    }
  }

  shoot(player, enemyBullets) {
    if (typeof EnemyBullet !== "undefined" && enemyBullets) {
      const ang = atan2(player.y - this.y, player.x - this.x);
      const spd = -0.007 * width;
      const vx = cos(ang) * spd;
      const vy = sin(ang) * spd;
      enemyBullets.push(new EnemyBullet(this.x, this.y, vx, vy));
    }
  }

  // Kolizje prostokąt/okrąg (używane przez player)
  hits(player) {
    return rectCircleCollision(
      player.x,
      player.y,
      player.width,
      player.height,
      this.x,
      this.y,
      this.radius
    );
  }

  handleCollision(player) {
    if (frameCount - this.lastCollisionFrame >= 30) {
      player.takeDamage(15);
      if (player.shieldPower <= 0) player.startExplosion();
      this.phase = "repelled";
      this.repelTimer = 10;
      const deg = random(-15, 15);
      const ang = radians(deg);
      const spd = 0.015 * width;
      this.repelVelocityX = cos(ang) * spd;
      this.repelVelocityY = sin(ang) * spd;
      this.individualMovementX = 0;
      this.individualMovementY = 0;
      this.lastCollisionFrame = frameCount;
    }
  }

  abducts(humanoid) {
    if (
      rectCircleCollision(
        humanoid.x,
        humanoid.y,
        humanoid.radius * 2,
        humanoid.radius * 2,
        this.x,
        this.y,
        this.radius
      )
    ) {
      humanoid.y -= 0.00156 * width;
      if (humanoid.y < 0 || humanoid.y > height) return true;
      return false;
    }
    return false;
  }

  // Sprawdza czy pocisk koliduje z wrogiem (geometrycznie)
  hitByBullet(bullet) {
    const r = Enemy_grupa1.FORCEFIELD_RADIUS; // pole siłowe, nie statek!
  
    return rectCircleCollision(
        bullet.x,
        bullet.y,
        bullet.width || 2,
        bullet.height || 2,
        this.x,
        this.y,
        r
    );
  }


  /**
   * Obsługa trafienia pociskiem - wywołuj tę metodę z game.js/level
   * bullet - obiekt pocisku (możemy użyć jego x/y)
   * amount - obrażenia (liczba) - domyślnie 1
   * Zwraca: true jeśli pocisk został "zużyty" (zwykle tak)
   */
  handleBulletImpact(bullet, amount = 1) {
    // zapisz pozycję trafienia dla efektu
    const hitX = bullet.x || this.x;
    const hitY = bullet.y || this.y;
    this._lastBulletHitPos = { x: hitX, y: hitY };

    // Jeśli tarcza aktywna -> pochłania
    if (this.shieldHP > 0) {
      // koszt na jedną kule
      const dmg = amount;
      this.applyShieldDamage(dmg, hitX, hitY);
      // efekt i zatrzymanie - pocisk nie uszkadza zdrowia
      return true;
    }

    // brak tarczy -> rani zdrowie
    return this.takeDamage(amount);
  }

  // Tarcza: odejmowanie HP, flash i efekt rozprysku
  applyShieldDamage(amount, x, y) {
    if (this.shieldHP <= 0) return false;

    this.shieldHP -= amount;
    this.shieldHitFlash = 8;
    this.shieldHitX = x;
    this.shieldHitY = y;

    if (this.shieldHP <= 0) {
      this.shieldHP = 0;
      // Wywołanie obsługi zniszczenia tarczy (uruchomienie ruchu w lewo)
      if (typeof this.onShieldDestroyed === 'function') {
        this.onShieldDestroyed();
      }
      return true;
    }

    return false;
  }


  // Efekt trafienia w tarczę - dostępne dla level/game
  spawnShieldHitEffect(x, y) {
    // Tworzymy kilka drobnych cząstek rozbrysku (możesz rozbudować system cząstek w game.js)
    // Lokalnie przechowujemy je w explosionParticles (tych samych, które są używane przy detonacji)
    for (let i = 0; i < 6; i++) {
      this.explosionParticles.push({
        x: x,
        y: y,
        vx: random(-0.002 * width, 0.002 * width),
        vy: random(-0.002 * height, 0.002 * height),
        life: 12
      });
    }
  }

  // Zdrowie wroga
  takeDamage(amount) {
    // Jeśli tarcza nadal istnieje, pochłania obrażenia (bez zmiany health)
    if (this.shieldHP > 0) {
      this.applyShieldDamage(amount, this.x, this.y);
      return false;
    }

    this.health -= amount;
    if (this.health <= 0 && !this.exploded) {
      score += this.points;
      this.startExplosion();
      this.exploded = true;
      return true;
    }
    return false;
  }

  startExplosion() {
    this.explosionFrame = 60; // Wydłużony, efektowny wybuch na 60 klatek
    this.explosionParticles = [];

    // Warstwa 1: Smużyste Odłamki Energii - 15 sztuk (Neonowy, elektryczny cyjan)
    for (let i = 0; i < 15; i++) {
      this.explosionParticles.push({
        type: 1,
        x: this.x, y: this.y,
        vx: random(-5, 5), vy: random(-5, 5),
        size: random(1, 3)
      });
    }

    // Warstwa 2: Chmura plazmy i przeciążonej tarczy - 25 sztuk (Jasny lazurowy błękit)
    for (let i = 0; i < 25; i++) {
      this.explosionParticles.push({
        type: 2,
        x: this.x, y: this.y,
        vx: random(-4, 4), vy: random(-4, 4),
        size: random([2, 3, 5])
      });
    }

    // Warstwa 3: Odłamki pancerza tech-skrzydła - 15 sztuk (Głęboki kosmiczny błękit)
    for (let i = 0; i < 15; i++) {
      this.explosionParticles.push({
        type: 3,
        x: this.x, y: this.y,
        vx: random(-2.5, 2.5), vy: random(-2.5, 2.5),
        w: random(4, 8), h: random(2, 5)
      });
    }
  }

  isDestroyed() {
    return this.exploded && this.explosionFrame <= 0;
  }

  handleRepelled() {
    this.x += this.repelVelocityX;
    this.y += this.repelVelocityY;
    this.repelVelocityX *= 0.8;
    this.repelVelocityY *= 0.8;
    this.repelTimer--;
    if (this.repelTimer <= 0) {
      const deg = random(150, 210);
      const ang = radians(deg);
      const spd = 0.003 * width;
      this.individualMovementX = cos(ang) * spd;
      this.individualMovementY = sin(ang) * spd;
      this.phase = "shoot";
    }
  }

  onShieldDestroyed() {
    // Zapobiegamy wielokrotnemu wywołaniu
    if (this._shieldDestroyedCalled) return;
    this._shieldDestroyedCalled = true;

    // Jeśli wróg już eksploduje, przerywamy
    if (this.explosionFrame > 0 || this.exploded) return;

    // Ustawienia identyczne jak przy kolizji -> odepchnięcie i wejście w fazę 'repelled'
    this.phase = 'repelled';
    this.repelTimer = 10; // taki sam krótki efekt odepchnięcia

    // Losowy kąt blisko 0 (w prawo) — możesz dostosować, ale kopiujemy logikę z handleCollision
    let angleDeg = random(-15, 15);
    let angleRad = radians(angleDeg);

    let repelSpeed = 0.015 * width; // ta sama wartość co w handleCollision

    this.repelVelocityX = cos(angleRad) * repelSpeed;
    this.repelVelocityY = sin(angleRad) * repelSpeed;

    // Reset ruchu indywidualnego (tak jak przy kolizji)
    this.individualMovementX = 0;
    this.individualMovementY = 0;

    // Zapamiętujemy moment (jak w handleCollision)
    this.lastCollisionFrame = frameCount;
  }


            // Rysowanie (statku + tarcza + efekty)
  // pg = warstwa WebGL (np. gpuLayer), na której renderujemy obiekty
  show(pg) {
    // --- KLUCZOWA POPRAWKA ---
    // Jeśli główna pętla gry wywoła enemy.show() bez argumentu,
    // automatycznie sięgamy po globalną warstwę gpuLayer.
    if (!pg && typeof gpuLayer !== 'undefined') {
      pg = gpuLayer;
    }

    // Jeśli z jakiegoś powodu gpuLayer nadal nie istnieje, przerywamy,
    // aby zapobiec zawieszeniu się gry (crash).
    if (!pg) return; 

    if (this.spawnDelay > 0) return;

    // 1. Inicjalizacja shadera (jednorazowa dla całej klasy wrogów)
    if (!this.constructor.shaderLoaded) {
      this.constructor.shader = pg.createShader(ENEMY_VERT_SRC, ENEMY_FRAG_SRC);
      this.constructor.shaderLoaded = true;
    }

    // 2. Przygotowanie danych animacji
    // Mapowanie 60 klatek na wartość 0.0 -> 1.0
    let explRatio = 0.0;
    if (this.explosionFrame > 0) {
      explRatio = 1.0 - (this.explosionFrame / 60.0);
    }

    // Obliczenie wektora trafienia dla shadera (-1 do 1)
    let hitU = 0.0;
    let hitV = 0.0;
    if (this.shieldHitFlash > 0) {
      hitU = (this.shieldHitX - this.x) / this.radius;
      hitV = (this.shieldHitY - this.y) / this.radius;
      this.shieldHitFlash--;
    }

    const isChasingMode = this.phase === "repelled" || (this.phase === "shoot" && this.individualMovementX !== 0);

    // 3. Renderowanie wizualne na warstwie GPU
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    
    pg.shader(this.constructor.shader);
    this.constructor.shader.setUniform('uTime', millis() / 1000.0);
    this.constructor.shader.setUniform('uExplosion', explRatio);
    this.constructor.shader.setUniform('uShield', this.shieldHP > 0 ? 1.0 : 0.0);
    this.constructor.shader.setUniform('uChasing', isChasingMode ? 1.0 : 0.0);
    this.constructor.shader.setUniform('uHitFlash', this.shieldHitFlash / 8.0);
    this.constructor.shader.setUniform('uHitPos', [hitU, hitV]);

    // Rysujemy obszar obejmujący statek i efekty (tarczę/wybuch)
    pg.plane(this.radius * 3.5, this.radius * 3.5);
    
    pg.resetShader();
    pg.pop();

    // 4. Rysowanie interfejsu (Paski zdrowia/tarczy) w standardowym 2D
    // UI nie powinno przechodzić przez WebGL, więc wywołujemy je bezpośrednio
    if (this.explosionFrame === 0) {
      push();
      noStroke();
      const barW = 30;
      const barH = 4;
      const sx = this.x - barW / 2;
      const sy = this.y - this.radius - 12;
      
      // Tło paska
      fill(40, 40, 40, 160);
      rect(sx, sy, barW, barH);
      
      // Tarcza
      if (this.shieldHP > 0) {
        const pct = constrain(this.shieldHP / this.constructor.CHAIN_SHIELD_POWER, 0, 1);
        fill(80, 160, 255);
        rect(sx, sy, barW * pct, barH);
      }
      
      // Zdrowie
      const hpPct = constrain(this.health / this.constructor.HEALTH, 0, 1);
      fill(200, 50, 50, 200);
      rect(sx, sy - 6, barW * hpPct, 3);
      pop();
    }
  }
}

// --- pomocnicza funkcja kolizji (bez zmian) ---
function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
  let testX = cx;
  let testY = cy;
  if (cx < rx) testX = rx;
  else if (cx > rx + rw) testX = rx + rw;
  if (cy < ry) testY = ry;
  else if (cy > ry + rh) testY = ry + rh;
  const distX = cx - testX;
  const distY = cy - testY;
  const distance = sqrt(distX * distX + distY * distY);
  return distance <= cr;
}

// --- RYSOWANIE STATKU I POLA (zakładam, że te funkcje istnieją globalnie) ---
let flamePulse = 0;

function drawEnemyShip(x, y, isChasing) {
  push();
  translate(x, y);
  if (isChasing) rotate(sin(frameCount * 0.1) * 0.05);
  rotate(PI); // dziób w lewo
  scale(2);
  noStroke();

  const bordowy = color(110, 0, 20);
  const bordowyJasny = color(160, 20, 40);
  const braz = color(90, 55, 30);
  const brazCiemny = color(60, 30, 15);

  flamePulse = sin(frameCount * 0.2) * 2;
  fill(255, 120, 40, 150);
  ellipse(-14, 0, 12 + flamePulse, 4 + flamePulse / 2);
  fill(255, 80, 10, 100);
  ellipse(-18, 0, 20 + flamePulse, 7 + flamePulse / 2);

  fill(bordowy);
  beginShape();
  vertex(0, -6);
  vertex(10, 0);
  vertex(0, 6);
  vertex(-12, 6);
  vertex(-18, 0);
  vertex(-12, -6);
  endShape(CLOSE);

  fill(bordowyJasny);
  beginShape();
  vertex(-4, -4);
  vertex(6, 0);
  vertex(-4, 4);
  vertex(-10, 0);
  endShape(CLOSE);

  fill(brazCiemny);
  beginShape();
  vertex(-10, -5);
  vertex(-25, -12);
  vertex(-18, -2);
  endShape(CLOSE);

  fill(brazCiemny);
  beginShape();
  vertex(-10, 5);
  vertex(-25, 12);
  vertex(-18, 2);
  endShape(CLOSE);

  fill(braz);
  ellipse(-8, 0, 6, 3);

  pop();
}

// Pole siłowe (używane w show())
function drawForceField(x, y, t) {
  push();
  translate(x, y);
  noFill();
  let baseR = 35;
  let pulse = sin(t * 2) * 1.5;
  let R = baseR + pulse;
  for (let i = 0; i < 4; i++) {
    stroke(30, 180, 255, 40 - i * 8);
    strokeWeight(6 + i * 3);
    ellipse(0, 0, R * 2, R * 2);
  }
  stroke(80, 200, 255, 120);
  strokeWeight(1.6);
  beginShape();
  for (let a = 0; a < TWO_PI; a += 0.18) {
    let rWave = sin(a * 3 + t * 3) * 1.3;
    vertex((R + rWave) * cos(a), (R + rWave) * sin(a));
  }
  endShape(CLOSE);
  pop();
}
