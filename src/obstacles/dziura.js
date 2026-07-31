// 1. KLASA DUŻEJ CZARNEJ DZIURY (z dziura2.html)
class BigBlackHole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.numParticles = 400;
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    return {
      angle: random(TWO_PI),
      dist: random(50, 300),
      speed: random(0.01, 0.04),
      size: random(1, 3),
      color: color(`hsl(${floor(random(260, 300))}, 100%, 70%)`)
    };
  }

  update() {
    for (let p of this.particles) {
      p.angle += p.speed;
      p.dist -= 0.5;
      if (p.dist < 10) {
        p.dist = 250;
        p.angle = random(TWO_PI);
      }
    }
  }

  show() {
    push();
    translate(this.x, this.y);

    // Poświata grawitacyjna (z dziura2.html)
    let grad = drawingContext.createRadialGradient(0, 0, 10, 0, 0, 250);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.2, 'rgba(75, 0, 130, 0.2)');
    grad.addColorStop(1, 'transparent');
    drawingContext.fillStyle = grad;
    rect(-300, -300, 600, 600);

    for (let p of this.particles) {
      fill(p.color);
      noStroke();
      ellipse(cos(p.angle) * p.dist, sin(p.angle) * p.dist, p.size);
    }

    fill(0);
    ellipse(0, 0, 80); // r=40 -> d=80
    pop();
  }
}

// 2. KLASA MAŁEJ CZARNEJ DZIURY (zbudowana na logice BigWhiteHole)
class SmallBlackHole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, -1); // Ruch z bonuses.js
    this.vy = 0;
    this.radius = 42;         // Hitbox
    this.particles = [];
    this.numParticles = 50;  // liczba zasysanych cząstek do czarnej dziury
    
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    return {
      angle: random(TWO_PI),
      dist: random(30, 42),       // Startują na krawędzi aury
      speed: 0.02,  // Prędkość rotacji
      radialSpeed: 0.3, // Prędkość "zasysania" do środka
      size: random(0.5, 2),
      // Paleta neonowego fioletu i głębokiego indygo
      color: color(random(140, 180), 0, random(220, 255), random(190, 255))
    };      // kolor:      czerwony, zielony, niebieski, nasycenie z przedziału 0 do 255
  }

  update(cave) {
    // 1. Fizyka ruchu i kolizje ze ścianami
    this.x += this.vx;
    this.y += this.vy;

    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y, this.x, this.y, this.radius)) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y, this.x, this.y, this.radius)) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }

    // 2. Logika cząsteczek (odwrócona - wciąganie)
    for (let p of this.particles) {
      p.angle += p.speed;
      p.dist -= p.radialSpeed; // ZMNIEJSZAMY dystans (wciąganie do środka)
      
      // Jeśli cząsteczka wpadnie do jądra, resetujemy ją na zewnątrz
      if (p.dist < 2) {
        p.dist = random(35, 42);
        p.angle = random(TWO_PI);
      }
    }
  }

  show() {
    push();
    translate(this.x, this.y);

    // --- MROCZNA NEONOWA AURA (Logika gradientu z BigWhiteHole) ---
    // Promień dopasowany do małej dziury (42px)
    let grad = drawingContext.createRadialGradient(0, 0, 5, 0, 0, 42);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');           // Czarne jądro
    grad.addColorStop(0.3, 'rgba(75, 0, 130, 0.6)');    // Ciemny fioletowy neon
    grad.addColorStop(1, 'transparent');                // Wygaszenie
    
    drawingContext.fillStyle = grad;
    noStroke();
    // Używamy ellipse zamiast rect dla idealnego koła
    ellipse(0, 0, 84, 84);

    // --- CZĄSTECZKI (Zasysana materia) ---
    for (let p of this.particles) {
      fill(p.color);
      noStroke();
      ellipse(cos(p.angle) * p.dist, sin(p.angle) * p.dist, p.size);
    }

    // --- JĄDRO (Horyzont zdarzeń) ---
    let coreGrad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, 8);
    coreGrad.addColorStop(0, '#000');
    coreGrad.addColorStop(1, 'rgba(147, 0, 211, 0.4)'); // Fioletowa poświata na krawędzi
    drawingContext.fillStyle = coreGrad;
    ellipse(0, 0, 16, 16);

    pop();
  }

  // Mechanizm kolizji z graczem
  collected(player) {
    return rectCircleCollision(
      player.x - player.width / 2, 
      player.y - player.height / 2, 
      player.width, 
      player.height, 
      this.x, 
      this.y, 
      this.radius
    );
  }
}

// 3. KLASA DUŻEJ BIAŁEJ DZIURY (z dziura3.html)
class BigWhiteHole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.numParticles = 350;
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle() {
    return {
      angle: random(TWO_PI),
      dist: random(10, 30),
      speed: -random(0.01, 0.03), // W lewo
      radialSpeed: random(1, 2),    // Na zewnątrz
      size: random(0.5, 2.5),
      color: color(`hsl(${floor(random(180, 220))}, 100%, 80%)`)
    };
  }

  update() {
    for (let p of this.particles) {
      p.angle += p.speed;
      p.dist += p.radialSpeed;
      if (p.dist > 187.5) {
        p.dist = random(10, 30);
      }
    }
  }

  show() {
    push();
    translate(this.x, this.y);

    // Aura kwantowa (z dziura3.html)
    let grad = drawingContext.createRadialGradient(0, 0, 15, 0, 0, 187.5);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.2, 'rgba(0, 191, 255, 0.3)');
    grad.addColorStop(1, 'transparent');
    drawingContext.fillStyle = grad;
    rect(-225, -225, 450, 450);

    for (let p of this.particles) {
      fill(p.color);
      noStroke();
      ellipse(cos(p.angle) * p.dist, sin(p.angle) * p.dist, p.size);
    }

    // Emanujące jądro (r=15 -> d=30)
    let sunGrad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, 15);
    sunGrad.addColorStop(0, '#fff');
    sunGrad.addColorStop(0.5, '#00fbff');
    sunGrad.addColorStop(1, 'rgba(0, 251, 255, 0)');
    drawingContext.fillStyle = sunGrad;
    ellipse(0, 0, 40); // d=40 dla miękkiego przejścia
    pop();
  }
}

// 4. KLASA MAŁEJ BIAŁEJ DZIURY (z dziura3A.html + ruch/shield z bonuses.js)
class SmallWhiteHole {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, -1);
    this.vy = 0;
    this.radius = 25; // Hitbox dopasowany do miniatury
    
    this.particles = [];
    this.numParticles = 120;
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        angle: random(TWO_PI),
        dist: random(2.5, 7.5),
        speed: -random(0.02, 0.04),
        radialSpeed: random(0.3, 0.6),
        size: random(0.2, 1),
        color: color(`hsl(${floor(random(190, 220))}, 100%, 85%)`)
      });
    }
  }

  update(cave) {
    // Ruch z bonuses.js
    this.x += this.vx;
    this.y += this.vy;

    if (cave) {
      for (let i = 0; i < cave.topWalls.length - 1; i++) {
        if (rectCircleCollision(cave.topWalls[i].x, 0, cave.topWalls[i + 1].x - cave.topWalls[i].x, cave.topWalls[i].y, this.x, this.y, this.radius)) {
          this.vy = -this.vy;
          this.y = cave.topWalls[i].y + this.radius;
          break;
        }
      }
      for (let i = 0; i < cave.bottomWalls.length - 1; i++) {
        if (rectCircleCollision(cave.bottomWalls[i].x, cave.bottomWalls[i].y, cave.bottomWalls[i + 1].x - cave.bottomWalls[i].x, height - cave.bottomWalls[i].y, this.x, this.y, this.radius)) {
          this.vy = -this.vy;
          this.y = cave.bottomWalls[i].y - this.radius;
          break;
        }
      }
    }

    for (let p of this.particles) {
      p.angle += p.speed;
      p.dist += p.radialSpeed;
      if (p.dist > 47) p.dist = random(2, 5);
    }
  }

  show() {
    push();
    translate(this.x, this.y);
    
    // Miniaturowa aura (z dziura3A.html)
    let grad = drawingContext.createRadialGradient(0, 0, 3.75, 0, 0, 47);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(0.3, 'rgba(0, 251, 255, 0.2)');
    grad.addColorStop(1, 'transparent');
    drawingContext.fillStyle = grad;
    rect(-56, -56, 112, 112);

    for (let p of this.particles) {
      fill(p.color);
      noStroke();
      ellipse(cos(p.angle) * p.dist, sin(p.angle) * p.dist, p.size);
    }

    // Mini jądro (r=3.75 -> d=7.5)
    let sunGrad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, 3.75);
    sunGrad.addColorStop(0, '#fff');
    sunGrad.addColorStop(1, 'rgba(0, 251, 255, 0)');
    drawingContext.fillStyle = sunGrad;
    ellipse(0, 0, 10);
    pop();
  }

  // Mechanizm kolizji - Max Shield (z ShieldBoost)
  collected(player) {
    let hit = rectCircleCollision(
      player.x - player.width / 2, 
      player.y - player.height / 2, 
      player.width, 
      player.height, 
      this.x, 
      this.y, 
      this.radius
    );
    
    if (hit) {
      // Ustawiamy tarczę na 100 (zgodnie z rakieta.js)
      player.shieldPower = 100; 
      // Jeśli masz dźwięk tarczy, możesz go tu wywołać:
      if (typeof playShieldSound === 'function') playShieldSound();
    }
    return hit;
  }
}