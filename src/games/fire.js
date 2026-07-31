// Wspólny vertex shader dla WSZYSTKICH pocisków w tym pliku - rysowanych na
// współdzielonej warstwie gpuLayer (patrz game.js) zamiast osobnych createGraphics().
// Używa standardowej macierzy kamery p5 (uModelViewMatrix/uProjectionMatrix),
// dzięki czemu można go pozycjonować zwykłym pg.translate()/pg.rotate() + pg.plane(),
// a wszystkie fragment shadery poniżej działają BEZ ŻADNYCH ZMIAN (nadal czytają vUv).
const FIRE_SHARED_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

class FireController {
  constructor(player) {
    this.player = player;
    this.bullets = [];
    this.lastShotTime = 0;
    this.autoFireEnabled = false;
    this.shootTimer = 0;
    this.shootInterval = 10; // 1 strzał na 10 klatek
    this.weaponSoundFunctions = {
      1: playSoundWeapon1,
      2: playSoundWeapon2,
      3: playSoundWeapon3,
      4: playSoundWeapon4,
      5: playSoundWeapon5,
      6: playSoundWeapon6,
      7: playSoundWeapon9,
      8: playSoundWeapon9,
      9: playSoundWeapon7,   // fireball 1
      10: playSoundWeapon8,  // fireball 2
      11: playSoundWeapon8,  // fireball 3
      12: playSoundWeapon10,
      13: playSoundWeapon11,
      14: playSoundWeapon12
    };
  }

  shoot() {

    // --- BLOKADA ABSOLUTNA gdy rakieta straci tarczę---
    if (!this.player.isActive()) return;

    let bulletSpeed = 10;
    let x = this.player.x + this.player.width / 2;
    let y = this.player.y;
    let rocketFired = false;

// Broń 1- laser x1
if (this.player.weaponLevel === 1) {  
//                                x,y – Pozycja startowa
//                                      1 (damage) – Obrażenia. Siła rażenia pocisku
//                                         10 (width) – Szerokość pocisku i kolizji. Określa fizyczną szerokość "pudełka kolizyjnego" (bounding box) lasera oraz wpływa na to, jak szeroka będzie tekstura shadera na ekranie.
//                                             10 (height) – Wysokość pocisku. Określa fizyczną wysokość lasera.
//                                                false (hasOutline) – Obrys pocisku. Flaga logiczna (true/false) informująca silnik gry, czy pocisk ma mieć rysowaną dodatkową krawędź/obwódkę. W tym przypadku jest wyłączona (false), ponieważ shader sam w sobie generuje piękny, rozżarzony efekt
//                                                       0 (angle) – Kąt lotu (w radianach). Wartość 0 oznacza, że pocisk leci idealnie poziomo w prawą stronę ekranu. Przy wyższych poziomach broni (np. poziomie 5) używasz tutaj np. radians(10) lub -radians(10), aby pociski rozchodziły się wachlarzowo.
//                                                          bulletSpeed (speed) – Prędkość lotu. Wartość ta (zdefiniowana wyżej jako 10) określa, o ile pikseli na klatkę animacji pocisk przesunie się do przodu.
      this.bullets.push(new Laser(x, y, 1, 10, 3, false, 0, bulletSpeed));

// Broń 2- laser x2
    } else if (this.player.weaponLevel === 2) {
      this.bullets.push(new Laser(x, y - 5, 1, 10, 10, false, 0, bulletSpeed));
      this.bullets.push(new Laser(x, y + 5, 1, 10, 10, false, 0, bulletSpeed));

// Broń 3-laser x3
    } else if (this.player.weaponLevel === 3) {
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, 0, bulletSpeed));
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, radians(10), bulletSpeed));
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, -radians(10), bulletSpeed));

// Broń 4- laser x5
    } else if (this.player.weaponLevel === 4) {
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, 0, bulletSpeed));
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, radians(10), bulletSpeed));
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, -radians(10), bulletSpeed));
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, radians(20), bulletSpeed));
      this.bullets.push(new Laser(x, y, 1, 10, 10, false, -radians(20), bulletSpeed));

// Broń 5- mocny laser x1
    } else if (this.player.weaponLevel === 5) {
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, 0, bulletSpeed));

// Broń 6- mocny laser x2
    } else if (this.player.weaponLevel === 6) {
      this.bullets.push(new Laser(x, y - 7, 3, 30, 30, false, 0, bulletSpeed));
      this.bullets.push(new Laser(x, y + 7, 3, 30, 30, false, 0, bulletSpeed));

// Broń 7- mocny laser x3
    } else if (this.player.weaponLevel === 7) {
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, 0, bulletSpeed));
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, radians(10), bulletSpeed));
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, -radians(10), bulletSpeed));

// Broń 8- mocny laser x5
    } else if (this.player.weaponLevel === 8) {
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, 0, bulletSpeed));
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, radians(10), bulletSpeed));
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, -radians(10), bulletSpeed));
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, radians(20), bulletSpeed));
      this.bullets.push(new Laser(x, y, 3, 30, 30, false, -radians(20), bulletSpeed));

// Broń 9- Fireball x1
    } else if (this.player.weaponLevel === 9) {
      this.bullets.push(new Fireball(x, y, 5, 0, bulletSpeed));

// Broń 10- Fireball x2
    } else if (this.player.weaponLevel === 10) {
      this.bullets.push(new Fireball(x, y - 15, 5, 0, bulletSpeed));
      this.bullets.push(new Fireball(x, y + 15, 5, 0, bulletSpeed));

// Broń 11- Fireball x3
    } else if (this.player.weaponLevel === 11) {
      this.bullets.push(new Fireball(x, y, 5, 0, bulletSpeed));
      this.bullets.push(new Fireball(x, y, 5, radians(15), bulletSpeed));
      this.bullets.push(new Fireball(x, y, 5, -radians(15), bulletSpeed));

// Broń 12- Laser x1
    } else if (this.player.weaponLevel === 12) {
      this.bullets.push(new Lightning(x, y, 15, 0, bulletSpeed));

// Broń 13- Laser x2
    } else if (this.player.weaponLevel === 13) {
      this.bullets.push(new Lightning(x, y - 15, 15, 0, bulletSpeed));
      this.bullets.push(new Lightning(x, y + 15, 15, 0, bulletSpeed));

// Broń 14- Rakieta naprowadzająca
    } else if (this.player.weaponLevel === 14) {
      if (this.bullets.filter(b => b instanceof GuidedMissile).length < 3) {
        this.bullets.push(new GuidedMissile(x, y, 30, 0, 6));
        rocketFired = true;
      }
    }

    // --- POPRAWIONE ODTWARZANIE DŹWIĘKÓW (Dynamiczne dla 14 poziomów) ---
    if (this.player.weaponLevel === 14) {
      // Rakiety naprowadzające (teraz poziom 14) strzelają z ograniczeniem, 
      // więc dźwięk odpalamy tylko wtedy, gdy rakieta faktycznie poleciała
      if (rocketFired) {
        if (this.weaponSoundFunctions[this.player.weaponLevel]) {
          this.weaponSoundFunctions[this.player.weaponLevel]();
        } else {
          playSoundWeapon1();
        }
      }
    } else {
      // Dla wszystkich pozostałych broni (poziomy 1 - 13) odtwarzaj dźwięk normalnie przy każdym strzale
      if (this.weaponSoundFunctions[this.player.weaponLevel]) {
        this.weaponSoundFunctions[this.player.weaponLevel]();
      } else {
        playSoundWeapon1();
      }
    }
  } // <--- tu kończy się metoda shoot()

  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js) - patrz komentarz na górze pliku
  update(isPaused, levelController, pg) { // ZMIANA 1: DODANO levelController
    if (isPaused) return;

    let currentFrame = frameCount;
    let bulletsToRemove = [];

    // --- BLOKADA STRZELANIA: Sprawdzamy stan gracza przed wystrzałem ---
    if (this.player.isActive()) { 
      if (this.autoFireEnabled) {
        if (currentFrame % this.shootInterval === 0) {
          this.shoot();
        }
      }

      if (keyIsDown(32) && !isPaused) {
        if (currentFrame % this.shootInterval === 0) {
          this.shoot();
        }
      }
    } // --- KONIEC BLOKADY ---

    if (keyIsDown(32) && !isPaused) {
      if (currentFrame % this.shootInterval === 0) {
        this.shoot();
      }
    }

    // Przygotowanie współdzielonej warstwy GPU na rysowanie pocisków (shadery)
    pg.clear();
    pg.push();
    pg.translate(-pg.width / 2, -pg.height / 2, 0);

    for (let i = 0; i < this.bullets.length; i++) {
      this.bullets[i].update();
      this.bullets[i].show(pg);
      if (this.bullets[i].hits && typeof this.bullets[i].hits === 'function') {
        if (currentLevel && currentLevel.enemies) {
          for (let j = currentLevel.enemies.length - 1; j >= 0; j--) {
            if (this.bullets[i].hits(currentLevel.enemies[j])) {
              currentLevel.enemies[j].takeDamage(this.bullets[i].damage);
              // Usunięto logikę naliczania punktów, aby uniknąć duplikacji
              bulletsToRemove.push(i);
              break;
            }
          }
        }
        if (cave && cave.bats) {
          for (let j = cave.bats.length - 1; j >= 0; j--) {
            if (this.bullets[i].hits(cave.bats[j])) {
              cave.bats[j].takeDamage(this.bullets[i].damage);
              // Usunięto logikę naliczania punktów, aby uniknąć duplikacji
              bulletsToRemove.push(i);
              break;
            }
          }
        }
      }
      // Sprawdzamy czy pocisk (w tym rakieta) wyleciał za dowolną krawędź ekranu
      // Dodany margines 50 pikseli sprawia, że pocisk znika dopiero, gdy w całości opuści widoczny obszar
      if (this.bullets[i].x > width + 50 || 
          this.bullets[i].x < -50 || 
          this.bullets[i].y > height + 50 || 
          this.bullets[i].y < -50) {
        bulletsToRemove.push(i);
      }
    }

    pg.pop();

    // ZMIANA 2: NOWA LOGIKA KOLIZJI Z PRZESZKODAMI (przeniesiona z Level10)
    if (levelController && levelController.obstacles) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let bullet = this.bullets[i];
            
            // WAŻNE: W tym miejscu NIE dodajemy jeszcze warunku wykluczającego rakiety, 
            // ponieważ testujemy tylko przeniesienie KODU dla POCISKÓW LASER (które mają width/height)

            for (let obstacle of levelController.obstacles) {
                if (rectRectCollision(
                    bullet.x, bullet.y, bullet.width, bullet.height,
                    obstacle.x, obstacle.y - obstacle.length / 2, obstacle.width, obstacle.length
                )) {
                    playSoundTrafieniewPrzeszkode();
                    // Generowanie iskier przy kolizji
                    if (levelController.sparkParticles) { // Sprawdzamy czy istnieje tablica sparkParticles
                        for (let j = 0; j < 5; j++) {
                            levelController.sparkParticles.push({
                                x: bullet.x,
                                y: bullet.y,
                                vx: random(-2, 2),
                                vy: random(-2, 2),
                                life: 15
                            });
                        }
                    }
                    bulletsToRemove.push(i);
                    break;
                }
            }
        }
    }


    for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
      // Używamy bezpiecznej metody, która upewnia się, że pocisk nadal istnieje
      if (this.bullets[bulletsToRemove[i]]) this.bullets.splice(bulletsToRemove[i], 1);
    }

    this.player.bullets = this.bullets;
  }

  handleKeyPressed(keyCode, isPaused) {
    if (isPaused) return;

    if (keyCode === 86) { // Klawisz "v"
      this.autoFireEnabled = !this.autoFireEnabled;
    }
  }

  handleKeyReleased(keyCode) {
    // Nie jest potrzebne, ponieważ keyIsDown() jest w pętli update
  }
  // Nowa metoda do ręcznej aktualizacji poziomu broni (wymagana przez klawisze N/M w game.js)
  updateWeaponLevel(newLevel) {
    // Aktualizujemy poziom broni gracza, który jest używany przez metodę shoot()
    this.player.weaponLevel = newLevel;
    
    // 🚀 ODTWARZANIE DŹWIĘKU ZMIANY BRONI
    playSoundZmianaBroni();

  }
}

class Laser {
  constructor(x, y, damage, width, height, hasOutline = false, angle = 0, speed) {
    this.x = x;
    this.y = y;
    this.vx = speed * cos(angle);
    this.vy = speed * sin(angle);
    this.width = width;
    this.height = height;
    this.damage = damage;
    this.hasOutline = hasOutline;
    this.angle = angle;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

// początek shadera czerwonego lasra
  static initShaders(pg) {
    if (Laser.shadersLoaded) return;
    const frag = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        
        float distY = abs(uv.y);
        float distX = abs(uv.x * 2.0);

        float glow = 0.05 / (distY + 0.02); 
        float edgeX = smoothstep(0.9, 0.4, distX);
        
        vec3 coreColor = vec3(1.0, 0.8, 0.8);
        vec3 glowColor = vec3(1.0, 0.0, 0.0);
        
        vec3 col = mix(glowColor, coreColor, smoothstep(0.15, 0.0, distY));
        col *= glow * edgeX;
        
        float pulse = sin(uTime * 25.0) * 0.15 + 0.85;
        col *= pulse;
        
        float alpha = max(col.r, max(col.g, col.b));
        
        gl_FragColor = vec4(col, alpha);
      }`;
    Laser.shader = pg.createShader(FIRE_SHARED_VERT_SRC, frag);
    Laser.shadersLoaded = true;
  }

  show(pg) {
    Laser.initShaders(pg);

    let s = this.width * 2.0;

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.angle);
    pg.noStroke();
    pg.blendMode(ADD);
    pg.translate(this.width / 2, 0, 0); // oryginalny offset środka tekstury
    pg.shader(Laser.shader);
    Laser.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(s, s);
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }
// koniec shadera czerwonego lasra

  hits(enemy) {
    return rectCircleCollision(this.x, this.y, this.width, this.height, enemy.x, enemy.y, enemy.radius);
  }
}

class Fireball {
  constructor(x, y, damage, angle = 0, speed) {
    this.x = x;
    this.y = y;
    this.vx = speed * cos(angle);
    this.vy = speed * sin(angle);
    this.radius = 6;
    this.damage = damage;
    this.angle = angle;
    this.frame = 0;
    // NOWE LINIE: Dodanie wymiarów prostokątnych dla kolizji z przeszkodami/asteroidami
    this.width = this.radius * 4; // np. 12 pikseli
    this.height = this.radius * 4; // np. 12 pikseli
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.frame++;
  }


// początek shadera kuli ognia
  static initShaders(pg) {
    if (Fireball.shadersLoaded) return;
    const frag = `precision highp float;
      varying vec2 vUv;
      uniform float uTime;

      float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float noise(in vec2 st) {
          vec2 i = floor(st); vec2 f = fract(st);
          float a = random(i); float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(in vec2 st) {
          float value = 0.0; float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
              value += amplitude * noise(st);
              st *= 2.0; amplitude *= 0.5;
          }
          return value;
      }

      void main() {
          vec2 uv = (vUv - 0.5) * 3.0; 
          
          vec2 center = vec2(0.3, 0.0);
          float dist = length(uv - center);

          vec2 fireMovement = vec2(uTime * 3.0, 0.0);
          float n = fbm((uv * 1.5) + fireMovement);

          float shape = smoothstep(0.6, 0.0, dist + (uv.x * 0.4));
          
          float fireEnergy = shape * (n * 1.0);

          vec3 color = vec3(0.0);
          if (fireEnergy > 0.1) {
              color = mix(vec3(0.8, 0.1, 0.0), vec3(1.0, 0.9, 0.2), smoothstep(0.2, 0.8, fireEnergy));
          }

          float glowRadius = 2.2;
          vec2 glowCenter = center - vec2(0.2, 0.0); 
          float distGlow = length(uv - glowCenter);
          float glowIntensity = smoothstep(glowRadius, 0.0, distGlow);
          glowIntensity = pow(glowIntensity, 4.0) * 0.6; 
          
          color += vec3(1.0, 0.4, 0.0) * glowIntensity;

          float fireAlpha = smoothstep(0.0, 0.5, fireEnergy);
          float finalAlpha = max(fireAlpha, glowIntensity);

          gl_FragColor = vec4(color, finalAlpha);
      }`;
    Fireball.shader = pg.createShader(FIRE_SHARED_VERT_SRC, frag);
    Fireball.shadersLoaded = true;
  }

  show(pg) {
    Fireball.initShaders(pg);

    let visualSize = this.width * 2.0; // TU JEST ROZMIAR SKALOWANIA SHADERA ! ! !

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.angle);
    pg.noStroke();
    pg.blendMode(ADD);
    pg.shader(Fireball.shader);
    Fireball.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(visualSize, visualSize);
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }
// koniec shadera kuli ognia


  hits(enemy) {
    return circleCircleCollision(this.x, this.y, this.radius, enemy.x, enemy.y, enemy.radius);
  }
}

class Lightning {
  constructor(x, y, damage, angle = 0, speed) {
    this.x = x;
    this.y = y;
    this.vx = speed * cos(angle);
    this.vy = speed * sin(angle);
    this.damage = damage;
    
    this.angle = angle; // <-- DODANA LINIJKA NAPRAWIAJĄCA BŁĄD MACIERZY WEBGL
    
    this.length = 60;
    this.width = 20;
    this.height = this.length; // dla kolizji
    this.frame = 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.frame++;
  }

// Początek shadera pioruna
  static initShaders(pg) {
    if (Lightning.shadersLoaded) return;
    const frag = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      
      float fbm(vec2 p) {
        float f = 0.0; float a = 0.5;
        for(int i = 0; i < 4; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
        return f;
      }

      void main() {
        vec2 uv = vUv;
        uv.y = (uv.y - 0.5) * 2.0; 
        
        float scrollTime = uTime * 6.0;
        float n1 = fbm(vec2(uv.x * 6.0 - scrollTime, uv.y * 2.0));
        float n2 = fbm(vec2(uv.x * 12.0 - scrollTime * 1.5, uv.y * 4.0 - uTime));
        
        float distortion = (n1 - 0.5) * 0.4;
        float distY = abs(uv.y + distortion);
        
        float core = smoothstep(0.15, 0.0, distY);
        float plasma = smoothstep(0.6, 0.0, distY) * n2;
        
        float pulse = sin(uv.x * 30.0 - scrollTime * 2.0) * 0.5 + 0.5;
        plasma += pulse * 0.3 * smoothstep(0.3, 0.0, distY);
        
        float edgeFade = smoothstep(1.0, 0.8, abs(uv.y));
        float lengthFade = smoothstep(0.0, 0.15, uv.x) * smoothstep(1.0, 0.85, uv.x);
        
        float intensity = (core + plasma) * edgeFade * lengthFade;
        
        vec3 colMagenta = vec3(1.0, 0.2, 0.8);
        vec3 colCyan = vec3(0.0, 1.0, 0.9);
        vec3 colCore = vec3(1.0, 1.0, 1.0);
        
        vec3 finalColor = mix(colMagenta, colCyan, plasma);
        finalColor = mix(finalColor, colCore, core * 0.8);
        
        gl_FragColor = vec4(finalColor * intensity * 2.5, intensity);
      }`;
    Lightning.shader = pg.createShader(FIRE_SHARED_VERT_SRC, frag);
    Lightning.shadersLoaded = true;
  }

  show(pg) {
    Lightning.initShaders(pg);

    pg.push();
    pg.translate(this.x, this.y, 0);
    
    pg.rotate(this.angle); // <-- TERAZ OBRÓT ZADZIAŁA PRAWIDŁOWO
    
    pg.noStroke();
    pg.blendMode(ADD);
    pg.translate(this.length / 2, 0, 0);
    pg.shader(Lightning.shader);
    Lightning.shader.setUniform('uTime', millis() / 1000.0);
    pg.plane(this.length * 1.5, this.width * 1.5);
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }
// koniec shadera pocisku piorun

  hits(enemy) {
    return rectCircleCollision(this.x, this.y, this.width, this.length, enemy.x, enemy.y, enemy.radius);
  }
}

class GuidedMissile {
  constructor(x, y, damage, angle = 0, speed) {
    this.x = x;
    this.y = y;
    this.vx = speed * cos(angle);
    this.vy = speed * sin(angle);
    this.damage = damage;
    this.speed = speed;
    this.angle = angle;
    this.target = null;
    this.radius = 10;

    // NOWE LINIE: Wymiary prostokątne dla kolizji z przeszkodami/asteroidami
    // Oszacowanie: Długość całkowita to ok. 5.5 * radius, Szerokość to 2 * radius
    this.width = this.radius * 5.5; 
    this.height = this.radius * 2;

    this.frame = 0;
    this.flameParticles = [];
    this.dotInterval = 5;
  }

  update() {
    this.frame++;
    let minDistance = Infinity;
    let closestEnemy = null;
    if (currentLevel && currentLevel.enemies) {
      for (let enemy of currentLevel.enemies) {
        let dx = enemy.x - this.x;
        let dy = enemy.y - this.y;
        let distance = sqrt(dx * dx + dy * dy);
        if (distance < minDistance && !enemy.exploded) {
          minDistance = distance;
          closestEnemy = enemy;
        }
      }
    }
    if (cave && cave.bats) {
      for (let bat of cave.bats) {
        let dx = bat.x - this.x;
        let dy = bat.y - this.y;
        let distance = sqrt(dx * dx + dy * dy);
        if (distance < minDistance && !bat.explosionFrame) {
          minDistance = distance;
          closestEnemy = bat;
        }
      }
    }
    this.target = closestEnemy;

    if (this.target) {
      let dx = this.target.x - this.x;
      let dy = this.target.y - this.y;
      this.angle = atan2(dy, dx);
      let turnSpeed = 0.05;
      let targetVx = 10 * cos(this.angle);
      let targetVy = 10 * sin(this.angle);
      this.vx += (targetVx - this.vx) * turnSpeed;
      this.vy += (targetVy - this.vy) * turnSpeed;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.frame % 3 === 0) {
      this.flameParticles.push({
        x: this.x - this.radius * 1.5 * cos(this.angle + PI),
        y: this.y - this.radius * 1.5 * sin(this.angle + PI),
        vx: random(-0.001 * width, 0.001 * width),
        vy: random(-0.001 * height, 0.001 * height),
        life: 15
      });
    }
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      let particle = this.flameParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      if (particle.life <= 0) this.flameParticles.splice(i, 1);
    }
  }

// początek shadera pocisku samonaprowadzającego
  static initShaders(pg) {
    if (GuidedMissile.shadersLoaded) return;

    // --- 1. SHADER GAZÓW WYLOTOWYCH (na bazie silnika cofania) ---
    const fragGazy = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float f = 0.0; float a = 0.5;
        for(int i = 0; i < 3; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
        return f;
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;

        float startX = -0.7;                // zmiana na + przesuwa to ogień rakiety na prawą strinę shadera
        float distRight = -uv.x - startX;    //zmiana u.v na -u.v odwraca ogień w lewo

        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;

        if (distRight > 0.0) {
            float maxFlameLen = 1.3;
            float nx = distRight / maxFlameLen;

            if (nx < 1.0) {
                float width = mix(0.24, 0.48, nx);     // Zmiana szerokości płamienia na początu i końcu
                float profile = 1.0 - smoothstep(0.0, width, abs(uv.y));

                if (profile > 0.0) {
                    vec2 noiseUv = vec2(distRight * 12.0 - uTime * 25.0, uv.y * 20.0);
                    float turb = fbm(noiseUv);

                    float intensity = profile * pow(1.0 - nx, 1.2) * (0.4 + 0.6 * turb);

                    vec3 coreColor = vec3(1.0, 1.0, 0.7);
                    vec3 midColor  = vec3(1.0, 0.6, 0.0);
                    vec3 tipColor  = vec3(1.0, 0.1, 0.0);

                    vec3 fireColor = mix(tipColor, midColor, smoothstep(0.2, 0.6, intensity));
                    fireColor = mix(fireColor, coreColor, smoothstep(0.6, 1.0, intensity));

                    finalColor = fireColor * intensity * 2.5;
                    finalAlpha = intensity;
                }
            }
        }
        gl_FragColor = vec4(finalColor, finalAlpha);
      }`;
    GuidedMissile.exhaustShader = pg.createShader(FIRE_SHARED_VERT_SRC, fragGazy);

    // --- 2. SHADER KADŁUBA RAKIETY SAMONAPROWADZAJĄCEJ ---
    const fragRakieta = `precision mediump float;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }

      float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
        vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
        vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
        vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
        vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
        vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
        float s = sign(e0.x * e2.y - e0.y * e2.x);
        vec2 d0 = vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x));
        vec2 d1 = vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x));
        vec2 d2 = vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x));
        vec2 d = min(min(d0, d1), d2);
        return -sqrt(d.x) * sign(d.y);
      }

      const float TAIL_X = -30.0;
      const float BODY_R = 4.0;
      const float NOSE_TIP = 45.0;
      const float BODY_FRONT = 20.0;

      float radiusAtSafe(float x) {
        if (x <= BODY_FRONT) return BODY_R;
        float t = clamp((NOSE_TIP - x) / (NOSE_TIP - BODY_FRONT), 0.0, 1.0);
        return BODY_R * t;
      }

      float sdTubeCone(vec2 p) {
        float r = radiusAtSafe(p.x);
        float distY = abs(p.y) - r;
        float distFront = p.x - NOSE_TIP;
        float distBack = TAIL_X - p.x;
        return max(max(distY, distFront), distBack);
      }

      float sdFinTopRear(vec2 p) { return sdTriangle(p, vec2(-5.0, -4.0), vec2(-28.0, -4.0), vec2(-30.0, -12.0)); }
      float sdFinBotRear(vec2 p) { return sdTriangle(p, vec2(-5.0,  4.0), vec2(-28.0,  4.0), vec2(-30.0,  12.0)); }
      float sdFinTopMid(vec2 p) { return sdTriangle(p, vec2(15.0, -4.0), vec2(-8.0, -4.0), vec2(-10.0, -12.0)); }
      float sdFinBotMid(vec2 p) { return sdTriangle(p, vec2(15.0,  4.0), vec2(-8.0,  4.0), vec2(-10.0,  12.0)); }

      float sdHull(vec2 p) {
        float tube = sdTubeCone(p);
        float flatParts = min(min(sdFinTopRear(p), sdFinBotRear(p)), min(sdFinTopMid(p), sdFinBotMid(p)));
        float nozzleBox = sdBox(p - vec2(-29.0, 0.0), vec2(2.0, 3.5));
        flatParts = min(flatParts, nozzleBox);
        return min(tube, flatParts);
      }

      void main() {
        const float uZoom = 100.0;
        vec2 p = (vUv - 0.5) * uZoom;
        float aa = 0.6;

        float dTube = sdTubeCone(p);
        float dFlat = min(min(sdFinTopRear(p), sdFinBotRear(p)), min(sdFinTopMid(p), sdFinBotMid(p)));
        dFlat = min(dFlat, sdBox(p - vec2(-29.0, 0.0), vec2(2.0, 3.5)));
        float d = sdHull(p);

        vec3 col = vec3(0.0);
        float alpha = 0.0;

        if (d < aa) {
          float nz_ = noise(p * 0.4);
          vec3 baseColor = vec3(0.40, 0.45, 0.50);
          if (nz_ > 0.55) baseColor = vec3(0.45, 0.50, 0.55);

          float noseBlend = smoothstep(BODY_FRONT - 2.0, BODY_FRONT + 5.0, p.x);
          vec3 redColor = vec3(0.85, 0.1, 0.15);
          baseColor = mix(baseColor, redColor, noseBlend);

          vec3 finalColor;
          float wTube = step(dTube, dFlat);

          float r = radiusAtSafe(p.x);
          float ny = clamp(p.y / max(r, 0.001), -1.0, 1.0);
          float nzC = sqrt(max(0.0, 1.0 - ny * ny));
          vec3 Ncyl = vec3(0.0, ny, nzC);
          vec3 LcylTop = normalize(vec3(-0.2, -1.0, 0.15));
          vec3 LcylBot = normalize(vec3(-0.2,  1.0, 0.8));
          float diffCyl = max(clamp(dot(Ncyl, LcylTop), 0.0, 1.0), clamp(dot(Ncyl, LcylBot), 0.0, 1.0));
          vec3 cylColor = mix(baseColor * 0.4, baseColor * 1.5, diffCyl);
          cylColor += pow(diffCyl, 12.0) * 0.6;

          vec2 e = vec2(0.8, 0.0);
          vec2 grad = vec2(sdHull(p + e.xy) - sdHull(p - e.xy), sdHull(p + e.yx) - sdHull(p - e.yx));
          vec2 nFlat = normalize(grad + 1e-5);
          vec2 lightDirFlat = normalize(vec2(-0.5, p.y < 0.0 ? 1.0 : -1.0));
          float diffFlat = clamp(dot(nFlat, lightDirFlat) * 0.5 + 0.5, 0.0, 1.0);
          vec3 flatColor = mix(baseColor * 0.5, baseColor * 1.4, diffFlat);

          finalColor = mix(flatColor, cylColor, wTube);

          float lines = smoothstep(0.97, 1.0, fract(p.x * 0.55)) + smoothstep(0.97, 1.0, fract(p.y * 0.6));
          finalColor -= vec3(lines * 0.15) * wTube;

          float rim = smoothstep(1.5, 0.0, abs(d));
          finalColor += rim * 0.15;

          float maskHull = smoothstep(aa, -aa, d);
          col = finalColor;
          alpha = maskHull;
        }

        gl_FragColor = vec4(col * alpha, alpha);
      }`;
    GuidedMissile.hullShader = pg.createShader(FIRE_SHARED_VERT_SRC, fragRakieta);

    GuidedMissile.shadersLoaded = true;
  }

  show(pg) {
    GuidedMissile.initShaders(pg);

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.angle);
    pg.noStroke();

    // Gazy wyrzutowe rysowane jako pierwsze (z tyłu), addytywnie
    pg.push();
    pg.blendMode(ADD);
    pg.translate(-43, 0, 0); // odsuniete do tylu, pod dysze - jak w oryginale
    pg.shader(GuidedMissile.exhaustShader);
    GuidedMissile.exhaustShader.setUniform('uTime', millis() / 1000.0);
    pg.plane(40, 40); // natywny rozmiar dawnego gazyPociskuGfx
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();

    // Kadłub rysowany na wierzchu - PELNY, bez ucinania (patrz uwaga nizej)
    pg.shader(GuidedMissile.hullShader);
    pg.plane(90, 90); // natywny rozmiar dawnego kierowanaRakietaGfx
    pg.resetShader();

    pg.pop();
  }
// koniec shadera pocisku samonaprowadzającego

  hits(enemy) {
    return circleCircleCollision(this.x, this.y, this.radius, enemy.x, enemy.y, enemy.radius);
  }
}


