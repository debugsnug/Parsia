
    /* ──────────────────────────────────────────
       INTRO — Three.js particle starfield
    ────────────────────────────────────────── */
    (function () {
      const canvas = document.getElementById('intro-canvas');
      const W = canvas.width = window.innerWidth;
      const H = canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');

      const pts = Array.from({ length: 260 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - .5) * .25,
        vy: (Math.random() - .5) * .25,
        r: Math.random() * 1.8 + .4,
        a: Math.random() * .7 + .15,
        tw: Math.random() * Math.PI * 2,
        ts: Math.random() * .018 + .004,
        col: ['#00c9b1', '#0077b6', '#7b2fff', '#4af0e0'][Math.floor(Math.random() * 4)]
      }));

      let raf, gone = false;

      function tick() {
        ctx.fillStyle = 'rgba(4,8,15,.14)';
        ctx.fillRect(0, 0, W, H);
        pts.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.tw += p.ts;
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
          const a = p.a * (.5 + .5 * Math.sin(p.tw));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.col + Math.floor(a * 255).toString(16).padStart(2, '0');
          ctx.fill();
        });
        // Occasional streak
        if (Math.random() < .0018) {
          const sx = Math.random() * W, sy = Math.random() * H * .5;
          const g = ctx.createLinearGradient(sx, sy, sx + 110, sy + 18);
          g.addColorStop(0, 'rgba(0,201,177,0)');
          g.addColorStop(.5, 'rgba(0,201,177,.75)');
          g.addColorStop(1, 'rgba(0,201,177,0)');
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 110, sy + 18);
          ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.stroke();
        }
        if (!gone) raf = requestAnimationFrame(tick);
      }
      tick();

      /* Dismiss intro, reveal the LANDING PAGE */
      function openLanding() {
        gone = true;
        cancelAnimationFrame(raf);
        const intro = document.getElementById('intro');
        intro.style.transition = 'opacity .85s ease';
        intro.style.opacity = '0';
        setTimeout(() => {
          intro.style.display = 'none';
          const landing = document.getElementById('landing');
          landing.classList.add('visible');
          initLandingEffects();
        }, 860);
      }

      /* Landing → Story Modal (requires login) */
      function openStoryModal() {
        document.getElementById('landing').style.transition = 'opacity .6s ease';
        document.getElementById('landing').style.opacity = '0';
        setTimeout(() => {
          document.getElementById('landing').style.display = 'none';
          document.getElementById('landing').classList.remove('visible');
          document.getElementById('story-modal').classList.add('visible');
          document.body.style.cursor = '';
        }, 620);
      }

      /* Require login before accessing the studio */
      function requireLogin(callback) {
        /* Check if Supabase auth is available and user is logged in */
        if (typeof window._parsiaUser !== 'undefined' && window._parsiaUser) {
          callback();
        } else {
          /* Show auth modal, then once signed in, proceed */
          const authModal = document.getElementById('auth-modal');
          if (authModal) {
            authModal.classList.add('visible');
            document.body.style.cursor = '';
            /* Store callback so auth code can call it after successful login */
            window._parsiaPostAuth = callback;
          } else {
            /* Fallback if no auth modal - proceed anyway */
            callback();
          }
        }
      }

      /* Go straight to the app (skip modal) */
      function launchApp() {
        document.getElementById('landing').style.display = 'none';
        document.getElementById('landing').classList.remove('visible');
        document.getElementById('story-modal').classList.remove('visible');
        document.getElementById('dsl-terminal').classList.remove('visible');
        document.getElementById('app').classList.add('visible');
        document.body.style.cursor = '';
        if (typeof Tour !== 'undefined') Tour.maybeStart();
      }
      /* Expose globally so the modal-controller IIFE can call it */
      window.launchApp = launchApp;

      /* Landing page CTA buttons — all require login */
      document.getElementById('lp-start-btn').addEventListener('click', () => requireLogin(openStoryModal));
      document.getElementById('lp-cta-btn').addEventListener('click', () => requireLogin(openStoryModal));
      document.getElementById('lp-nav-login').addEventListener('click', () => requireLogin(openStoryModal));
      document.getElementById('lp-demo-btn').addEventListener('click', () => {
        requireLogin(() => {
          document.getElementById('landing').style.display = 'none';
          document.getElementById('landing').classList.remove('visible');
          document.body.style.cursor = '';
          launchApp();
          setTimeout(() => doLoad(DEMO), 400);
        });
      });

      document.getElementById('enter-btn').addEventListener('click', openLanding);
      window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

      /* ═══════ LANDING PAGE EFFECTS ═══════ */
      function initLandingEffects() {
        const landing = document.getElementById('landing');
        const lpCanvas = document.getElementById('lp-canvas');
        const lpCtx = lpCanvas.getContext('2d');
        const cursor = document.getElementById('lp-cursor');
        const cursorDot = document.getElementById('lp-cursor-dot');
        let mx = window.innerWidth / 2, my = window.innerHeight / 2;
        let lpW, lpH;

        function resizeLp() {
          lpW = lpCanvas.width = window.innerWidth;
          lpH = lpCanvas.height = window.innerHeight;
        }
        resizeLp();
        window.addEventListener('resize', resizeLp);

        /* Custom cursor */
        landing.addEventListener('mousemove', e => {
          mx = e.clientX; my = e.clientY;
          cursor.style.left = mx + 'px';
          cursor.style.top = my + 'px';
          cursorDot.style.left = mx + 'px';
          cursorDot.style.top = my + 'px';
        });
        landing.addEventListener('mouseleave', () => {
          cursor.style.opacity = '0';
          cursorDot.style.opacity = '0';
        });
        landing.addEventListener('mouseenter', () => {
          cursor.style.opacity = '1';
          cursorDot.style.opacity = '1';
        });

        /* 3D tilt on feature cards */
        document.querySelectorAll('.lp-feat-card, .lp-how-card').forEach(card => {
          card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const cx = e.clientX - r.left, cy = e.clientY - r.top;
            const rx = ((cy / r.height) - 0.5) * -12;
            const ry = ((cx / r.width) - 0.5) * 12;
            card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
            card.style.setProperty('--mx', cx + 'px');
            card.style.setProperty('--my', cy + 'px');
          });
          card.addEventListener('mouseleave', () => {
            card.style.transform = '';
          });
        });

        /* Parallax on scroll */
        landing.addEventListener('scroll', () => {
          const st = landing.scrollTop;
          document.querySelectorAll('[data-parallax]').forEach(el => {
            const speed = parseFloat(el.dataset.parallax) || 0;
            el.style.transform = `translateY(${st * speed * -1}px)`;
          });
        });

        /* Intersection observer for scroll-reveal */
        const reveals = landing.querySelectorAll('.lp-reveal');
        const obs = new IntersectionObserver((entries) => {
          entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
        }, { threshold: 0.12, root: landing });
        reveals.forEach(el => obs.observe(el));

        /* ── Animated particle / orb background ── */
        const orbs = [];
        const particles = [];
        const ORB_COUNT = 5;
        const PARTICLE_COUNT = 80;

        for (let i = 0; i < ORB_COUNT; i++) {
          orbs.push({
            x: Math.random() * lpW, y: Math.random() * lpH,
            r: 80 + Math.random() * 180,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.2,
            hue: Math.random() > 0.5 ? 170 : 260,
            alpha: 0.025 + Math.random() * 0.02
          });
        }
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push({
            x: Math.random() * lpW, y: Math.random() * lpH,
            r: 0.5 + Math.random() * 1.5,
            vx: (Math.random() - 0.5) * 0.15,
            vy: -0.08 - Math.random() * 0.15,
            alpha: 0.2 + Math.random() * 0.5
          });
        }

        let lpRaf;
        function drawLpBg() {
          lpCtx.clearRect(0, 0, lpW, lpH);

          /* Ambient orbs */
          orbs.forEach(o => {
            o.x += o.vx; o.y += o.vy;
            if (o.x < -o.r) o.x = lpW + o.r;
            if (o.x > lpW + o.r) o.x = -o.r;
            if (o.y < -o.r) o.y = lpH + o.r;
            if (o.y > lpH + o.r) o.y = -o.r;
            const g = lpCtx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
            g.addColorStop(0, `hsla(${o.hue}, 80%, 55%, ${o.alpha})`);
            g.addColorStop(1, 'transparent');
            lpCtx.fillStyle = g;
            lpCtx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
          });

          /* Floating particles */
          particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.y < -10) { p.y = lpH + 10; p.x = Math.random() * lpW; }
            if (p.x < -10) p.x = lpW + 10;
            if (p.x > lpW + 10) p.x = -10;
            lpCtx.beginPath();
            lpCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            lpCtx.fillStyle = `rgba(0,201,177,${p.alpha})`;
            lpCtx.fill();
          });

          /* Subtle mouse-reactive glow */
          const mg = lpCtx.createRadialGradient(mx, my, 0, mx, my, 200);
          mg.addColorStop(0, 'rgba(0,201,177,.03)');
          mg.addColorStop(1, 'transparent');
          lpCtx.fillStyle = mg;
          lpCtx.fillRect(mx - 200, my - 200, 400, 400);

          /* Occasional shooting star */
          if (Math.random() < 0.003) {
            const sx = Math.random() * lpW, sy = Math.random() * lpH * 0.4;
            const sg = lpCtx.createLinearGradient(sx, sy, sx + 120, sy + 20);
            sg.addColorStop(0, 'rgba(0,201,177,0)');
            sg.addColorStop(0.5, 'rgba(0,201,177,.6)');
            sg.addColorStop(1, 'rgba(123,47,255,0)');
            lpCtx.beginPath(); lpCtx.moveTo(sx, sy); lpCtx.lineTo(sx + 120, sy + 20);
            lpCtx.strokeStyle = sg; lpCtx.lineWidth = 1.2; lpCtx.stroke();
          }

          if (landing.classList.contains('visible')) lpRaf = requestAnimationFrame(drawLpBg);
        }
        drawLpBg();
      }
    })();

    /* ──────────────────────────────────────────
       SCENE RENDERER — Canvas-based environments
    ────────────────────────────────────────── */
    const Scene = {
      canvas: null, ctx: null,
      name: 'Forest', fog: 0, raf: null,
      init(c) {
        this.canvas = c; this.ctx = c.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
      },
      resize() {
        const p = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = p.width; this.canvas.height = p.height;
        this.draw();
      },
      draw() {
        const { ctx: c, canvas, name } = this;
        const W = canvas.width, H = canvas.height;
        if (this.aiMode) { this._drawAtmosphere(W, H); this.fog = (this.fog + .28) % (W * 2); return; }
        const n = (name || '').toLowerCase();
        if (n.includes('castle') || n.includes('fort') || n.includes('dungeon') || n.includes('tower')) this.drawCastle(W, H);
        else if (n.includes('city') || n.includes('town') || n.includes('street') || n.includes('urban')) this.drawCity(W, H);
        else if (n.includes('beach') || n.includes('ocean') || n.includes('sea') || n.includes('shore')) this.drawBeach(W, H);
        else if (n.includes('mountain') || n.includes('hill') || n.includes('peak') || n.includes('valley')) this.drawMountains(W, H);
        else if (n.includes('space') || n.includes('galaxy') || n.includes('cosmos') || n.includes('planet')) this.drawSpace(W, H);
        else if (n.includes('tavern') || n.includes('inn') || n.includes('pub') || n.includes('bar')) this.drawTavern(W, H);
        else if (n.includes('school') || n.includes('class') || n.includes('campus') || n.includes('academy')) this.drawSchool(W, H);
        else if (n.includes('office') || n.includes('lab') || n.includes('library') || n.includes('room')) this.drawOffice(W, H);
        else if (n.includes('garden') || n.includes('park') || n.includes('meadow') || n.includes('field')) this.drawGarden(W, H);
        else if (n.includes('desert') || n.includes('sand') || n.includes('dune') || n.includes('wasteland')) this.drawDesert(W, H);
        else this.drawForest(W, H);
        this.fog = (this.fog + .28) % (W * 2);
      },
      drawForest(W, H) {
        const c = this.ctx;
        // Sky
        const sky = c.createLinearGradient(0, 0, 0, H * .65);
        sky.addColorStop(0, '#030610'); sky.addColorStop(.4, '#091425');
        sky.addColorStop(.75, '#0c1e38'); sky.addColorStop(1, '#0e2418');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Moon + halo
        const mx = W * .74, my = H * .16;
        const mg = c.createRadialGradient(mx, my, 4, mx, my, 32);
        mg.addColorStop(0, 'rgba(215,242,255,.96)'); mg.addColorStop(.65, 'rgba(190,228,255,.72)'); mg.addColorStop(1, 'rgba(120,180,255,0)');
        c.beginPath(); c.arc(mx, my, 32, 0, Math.PI * 2); c.fillStyle = mg; c.fill();
        const halo = c.createRadialGradient(mx, my, 28, mx, my, 110);
        halo.addColorStop(0, 'rgba(140,200,255,.14)'); halo.addColorStop(1, 'rgba(140,200,255,0)');
        c.beginPath(); c.arc(mx, my, 110, 0, Math.PI * 2); c.fillStyle = halo; c.fill();
        // Stars
        [[.09, .04], [.21, .11], [.34, .07], [.44, .16], [.56, .08], [.62, .21], [.79, .1], [.14, .26], [.29, .29], [.51, .22], [.91, .05], [.04, .29], [.66, .31], [.83, .19], [.41, .04], [.18, .17], [.72, .14]].forEach(([x, y]) => {
          const br = .55 + .45 * Math.sin(Date.now() * .001 + x * 12);
          c.beginPath(); c.arc(x * W, y * H, 1.4, 0, Math.PI * 2);
          c.fillStyle = `rgba(200,230,255,${br * .9})`; c.fill();
        });
        // BG trees (3 layers)
        c.save(); c.globalAlpha = .22; this._treeRow(W, H, 9, .56, .15, .38, '#132e18'); c.restore();
        c.save(); c.globalAlpha = .45; this._treeRow(W, H, 7, .62, .2, .52, '#0d2214'); c.restore();
        // Ground
        const grd = c.createLinearGradient(0, H * .63, 0, H);
        grd.addColorStop(0, '#091a09'); grd.addColorStop(.25, '#0b2010'); grd.addColorStop(1, '#040a04');
        c.fillStyle = grd; c.fillRect(0, H * .63, W, H * .37);
        // Grass tips
        c.save(); c.globalAlpha = .55;
        for (let i = 0; i < W; i += 5) { const gh = 7 + Math.sin(i * .35 + 1) * 4; c.beginPath(); c.moveTo(i, H * .63); c.quadraticCurveTo(i + 1.5, H * .63 - gh, i + 3, H * .63 - 1.5); c.strokeStyle = '#1a4020'; c.lineWidth = 1; c.stroke(); }
        c.restore();
        // FG trees
        c.save(); c.globalAlpha = .88; this._treeRow(W, H, 4, .73, .28, .78, '#050c05'); c.restore();
        // Fog
        this._fog(W, H);
        // Stage tint
        const sf = c.createLinearGradient(0, H * .77, 0, H * .85);
        sf.addColorStop(0, 'rgba(0,201,177,.04)'); sf.addColorStop(1, 'rgba(0,201,177,0)');
        c.fillStyle = sf; c.fillRect(0, H * .77, W, H * .08);
        c.beginPath(); c.moveTo(0, H * .77); c.lineTo(W, H * .77); c.strokeStyle = 'rgba(0,201,177,.06)'; c.lineWidth = 1; c.stroke();
      },
      drawCastle(W, H) {
        const c = this.ctx;
        const sky = c.createLinearGradient(0, 0, 0, H * .6);
        sky.addColorStop(0, '#0a0005'); sky.addColorStop(.5, '#1a0a28'); sky.addColorStop(1, '#2a1040');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Stars
        for (let i = 0; i < 60; i++) { const x = ((i * 137) % W), y = ((i * 97) % (H * .55)); c.beginPath(); c.arc(x, y, 1, 0, Math.PI * 2); c.fillStyle = `rgba(220,200,255,${.4 + .4 * Math.sin(Date.now() * .001 + i)})`; c.fill(); }
        // Castle silhouette
        c.fillStyle = '#0c0010';
        const cx = W * .5, by = H * .65;
        c.fillRect(cx - 80, by - 120, 160, 120); // keep
        [[cx - 80, by - 120, 20, 40], [cx - 60, by - 155, 15, 35], [cx + 40, by - 140, 20, 38], [cx + 60, by - 120, 20, 40]].forEach(([x, y, w, h]) => { c.fillRect(x, y, w, h); for (let t = 0; t < w; t += 7) { c.fillRect(x + t, y - 8, 4, 8); } });
        c.fillStyle = 'rgba(150,80,255,.15)'; c.beginPath(); c.arc(cx, by - 120, 8, 0, Math.PI * 2); c.fill();
        const gg = c.createLinearGradient(0, H * .6, 0, H);
        gg.addColorStop(0, '#0f080a'); gg.addColorStop(1, '#05020a');
        c.fillStyle = gg; c.fillRect(0, H * .6, W, H * .4);
        this._fog(W, H, .14);
      },
      _genCityWins(W, H) {
        // Pre-generate stable window data to avoid per-frame flicker
        this._cityWins = [];
        const builds = [[.05, .3, .1, .6], [.18, .15, .08, .65], [.3, .25, .12, .5], [.45, .1, .09, .65], [.58, .2, .1, .55], [.72, .05, .11, .7], [.85, .22, .09, .53]];
        builds.forEach(([x, y, w]) => {
          const bx = x * W, by = y * H, bw = w * W;
          for (let wy = by + 8; wy < H - 10; wy += 14)for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
            if (Math.random() < .45) this._cityWins.push({ x: wx, y: wy, a: .2 + Math.random() * .5 });
          }
        });
        this._cityBuilds = builds; this._cityW = W; this._cityH = H;
      },
      drawCity(W, H) {
        const c = this.ctx;
        if (!this._cityWins || this._cityW !== W || this._cityH !== H) this._genCityWins(W, H);
        const sky = c.createLinearGradient(0, 0, 0, H * .5);
        sky.addColorStop(0, '#000510'); sky.addColorStop(.5, '#001530'); sky.addColorStop(1, '#002050');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) { const x = ((i * 173) % W), y = ((i * 113) % (H * .45)); c.beginPath(); c.arc(x, y, .9, 0, Math.PI * 2); c.fillStyle = `rgba(200,230,255,${.3 + .3 * Math.sin(Date.now() * .001 + i)})`; c.fill(); }
        // Buildings
        this._cityBuilds.forEach(([x, y, w, h]) => {
          const bx = x * W, by = y * H, bw = w * W;
          c.fillStyle = '#030c1a'; c.fillRect(bx, by, bw, H - by);
          c.strokeStyle = 'rgba(0,119,182,.3)'; c.lineWidth = 1; c.strokeRect(bx, by, bw, H - by);
        });
        // Windows (stable)
        this._cityWins.forEach(({ x, y, a }) => { c.fillStyle = `rgba(255,220,80,${a})`; c.fillRect(x, y, 5, 8); });
        const road = c.createLinearGradient(0, H * .65, 0, H);
        road.addColorStop(0, '#030d18'); road.addColorStop(1, '#010508');
        c.fillStyle = road; c.fillRect(0, H * .65, W, H * .35);
        c.strokeStyle = 'rgba(0,201,177,.12)'; c.lineWidth = 2; c.setLineDash([30, 20]);
        c.beginPath(); c.moveTo(0, H * .82); c.lineTo(W, H * .82); c.stroke(); c.setLineDash([]);
        this._fog(W, H, .08);
      },
      _treeRow(W, H, n, yBase, wFact, hFact, col) {
        const c = this.ctx, sp = W / (n + 1);
        for (let i = 0; i <= n + 1; i++) {
          const x = (i + Math.sin(i * 2.7)) * (sp), th = H * hFact * (.65 + Math.sin(i * 1.9) * .35), tw = th * wFact, ty = H * yBase;
          c.fillStyle = col; c.fillRect(x - tw * .07, ty - th * .12, tw * .14, th * .16);
          for (let l = 0; l < 3; l++) {
            const ly = ty - th * (.08 + l * .3), lw = tw * (1.25 - l * .28), lh = th * .38;
            c.beginPath(); c.moveTo(x, ly - lh); c.lineTo(x + lw / 2, ly); c.lineTo(x - lw / 2, ly); c.closePath(); c.fillStyle = col; c.fill();
          }
        }
      },
      _fog(W, H, str = .11) {
        const c = this.ctx, fy = H * .6;
        for (let i = 0; i < 3; i++) {
          const off = (this.fog + i * W * .65) % (W * 2) - W;
          const fg = c.createLinearGradient(0, fy, 0, fy + 55);
          fg.addColorStop(0, 'rgba(20,50,30,0)'); fg.addColorStop(.5, `rgba(20,50,30,${str - i * .03})`); fg.addColorStop(1, 'rgba(20,50,30,0)');
          c.save(); c.fillStyle = fg; c.beginPath(); c.ellipse(off, fy + 28, W * .55, 38, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
      },
      drawBeach(W, H) {
        const c = this.ctx;
        // Sky gradient — warm golden hour
        const sky = c.createLinearGradient(0, 0, 0, H * .55);
        sky.addColorStop(0, '#0a1a3a'); sky.addColorStop(.4, '#1a3a6a'); sky.addColorStop(.75, '#e87040'); sky.addColorStop(1, '#f0a060');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Sun
        const sx = W * .72, sy = H * .28;
        const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 42);
        sg.addColorStop(0, 'rgba(255,220,80,1)'); sg.addColorStop(.5, 'rgba(255,180,50,.8)'); sg.addColorStop(1, 'rgba(255,100,20,0)');
        c.beginPath(); c.arc(sx, sy, 42, 0, Math.PI * 2); c.fillStyle = sg; c.fill();
        // Sun reflection on water
        const refl = c.createLinearGradient(sx - 15, H * .55, sx + 15, H * .9);
        refl.addColorStop(0, 'rgba(255,180,50,.4)'); refl.addColorStop(1, 'rgba(255,180,50,0)');
        c.fillStyle = refl; c.fillRect(sx - 15, H * .55, 30, H * .35);
        // Ocean
        const ocean = c.createLinearGradient(0, H * .55, 0, H * .75);
        ocean.addColorStop(0, '#0a3a6a'); ocean.addColorStop(.5, '#0d5080'); ocean.addColorStop(1, '#1a6090');
        c.fillStyle = ocean; c.fillRect(0, H * .55, W, H * .2);
        // Waves
        c.strokeStyle = 'rgba(150,220,255,.22)'; c.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const wy = H * .57 + i * H * .04;
          c.beginPath(); c.moveTo(0, wy);
          for (let x = 0; x < W; x += 40) c.quadraticCurveTo(x + 20, wy - 6 + Math.sin(x * .03 + Date.now() * .001) * 4, x + 40, wy);
          c.stroke();
        }
        // Sandy shore
        const sand = c.createLinearGradient(0, H * .74, 0, H);
        sand.addColorStop(0, '#c8a050'); sand.addColorStop(.4, '#d4b060'); sand.addColorStop(1, '#b89040');
        c.fillStyle = sand; c.fillRect(0, H * .74, W, H * .26);
        // Palm trees
        for (let i = 0; i < 3; i++) {
          const px = W * (.12 + i * .38), py = H * .74;
          c.fillStyle = '#5a3010'; c.fillRect(px - 5, py - H * .28, 10, H * .28);
          c.fillStyle = '#1a5010';
          for (let l = 0; l < 5; l++) {
            const angle = (l / 5) * Math.PI * 2;
            c.beginPath(); c.moveTo(px, py - H * .28);
            c.quadraticCurveTo(px + Math.cos(angle) * 30, py - H * .28 + Math.sin(angle) * 20 - 30, px + Math.cos(angle) * 60, py - H * .28 + Math.sin(angle) * 45 - 20);
            c.lineWidth = 4; c.strokeStyle = '#2a6818'; c.stroke();
          }
        }
        this._fog(W, H, .04);
      },
      drawMountains(W, H) {
        const c = this.ctx;
        const sky = c.createLinearGradient(0, 0, 0, H * .6);
        sky.addColorStop(0, '#04050a'); sky.addColorStop(.3, '#080e1e'); sky.addColorStop(.7, '#0d1830'); sky.addColorStop(1, '#1a2840');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Stars
        for (let i = 0; i < 80; i++) {
          const x = (i * 173 + 7) % W, y = (i * 97) % (H * .45);
          const br = .4 + .4 * Math.sin(Date.now() * .001 + i);
          c.beginPath(); c.arc(x, y, .9, 0, Math.PI * 2);
          c.fillStyle = `rgba(200,220,255,${br * .85})`; c.fill();
        }
        // Moon
        c.beginPath(); c.arc(W * .2, H * .12, 22, 0, Math.PI * 2);
        c.fillStyle = 'rgba(240,240,220,.9)'; c.fill();
        // Far mountains (blue-grey)
        c.fillStyle = '#0e1a2e';
        const peaks1 = [[-.05, .68], [.1, .45], [.22, .62], [.35, .38], [.48, .55], [.62, .35], [.75, .52], [.88, .4], [1.05, .58]];
        c.beginPath(); c.moveTo(0, H);
        peaks1.forEach(([x, y]) => c.lineTo(x * W, y * H));
        c.lineTo(W, H); c.closePath(); c.fill();
        // Snow caps on far peaks
        c.fillStyle = 'rgba(220,230,255,.15)';
        [[.1, .45], [.35, .38], [.62, .35], [.88, .4]].forEach(([x, y]) => {
          c.beginPath(); c.moveTo(x * W, y * H);
          c.lineTo(x * W - W * .04, y * H + H * .06);
          c.lineTo(x * W + W * .04, y * H + H * .06);
          c.closePath(); c.fill();
        });
        // Near mountains (dark)
        c.fillStyle = '#08101a';
        const peaks2 = [[-.05, .8], [.05, .62], [.18, .78], [.3, .55], [.44, .72], [.58, .5], [.72, .68], [.85, .54], [1.0, .72], [1.05, .82]];
        c.beginPath(); c.moveTo(0, H);
        peaks2.forEach(([x, y]) => c.lineTo(x * W, y * H));
        c.lineTo(W, H); c.closePath(); c.fill();
        // Ground
        const grd = c.createLinearGradient(0, H * .78, 0, H);
        grd.addColorStop(0, '#0a1808'); grd.addColorStop(1, '#060e05');
        c.fillStyle = grd; c.fillRect(0, H * .78, W, H * .22);
        this._fog(W, H, .1);
      },
      drawSpace(W, H) {
        const c = this.ctx;
        // Deep space bg
        c.fillStyle = '#000308'; c.fillRect(0, 0, W, H);
        // Nebula clouds
        const nebColors = ['rgba(60,0,120,.18)', 'rgba(0,40,120,.14)', 'rgba(120,20,80,.12)'];
        nebColors.forEach((col, i) => {
          const ng = c.createRadialGradient(W * (.2 + i * .3), H * (.3 + i * .15), 0, W * (.2 + i * .3), H * (.3 + i * .15), W * .35);
          ng.addColorStop(0, col); ng.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = ng; c.fillRect(0, 0, W, H);
        });
        // Stars (3 sizes)
        for (let i = 0; i < 200; i++) {
          const x = (i * 137 + 3) % W, y = (i * 79 + 11) % (H * .85);
          const r = i % 40 === 0 ? 1.8 : i % 10 === 0 ? 1.1 : .6;
          const br = .5 + .5 * Math.sin(Date.now() * .001 * (1 + i * .01) + i);
          c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
          c.fillStyle = `rgba(220,230,255,${br * .9})`; c.fill();
        }
        // Planet
        const pg = c.createRadialGradient(W * .75, H * .18, 4, W * .75, H * .18, 48);
        pg.addColorStop(0, '#4060c0'); pg.addColorStop(.6, '#203080'); pg.addColorStop(1, '#0a1040');
        c.beginPath(); c.arc(W * .75, H * .18, 48, 0, Math.PI * 2); c.fillStyle = pg; c.fill();
        // Planet ring
        c.save(); c.translate(W * .75, H * .18); c.rotate(-.3);
        c.strokeStyle = 'rgba(180,160,255,.35)'; c.lineWidth = 6;
        c.beginPath(); c.ellipse(0, 0, 70, 14, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        // Space ground (asteroid surface)
        c.fillStyle = '#0a0c12';
        c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += W / 12) c.lineTo(x, H * (.78 + Math.sin(x * .008) * .04));
        c.lineTo(W, H); c.closePath(); c.fill();
        // Craters
        for (let i = 0; i < 6; i++) {
          const cx = W * (.1 + i * .16), cy = H * .82 + Math.sin(i * 2.1) * H * .04;
          const cr = 8 + i * 5;
          c.beginPath(); c.arc(cx, cy, cr, 0, Math.PI * 2);
          c.strokeStyle = 'rgba(100,120,180,.2)'; c.lineWidth = 2; c.stroke();
        }
      },
      drawTavern(W, H) {
        const c = this.ctx;
        // Night sky outside window
        c.fillStyle = '#030610'; c.fillRect(0, 0, W, H);
        // Warm interior walls
        const wall = c.createLinearGradient(0, 0, 0, H);
        wall.addColorStop(0, '#1a0e05'); wall.addColorStop(.5, '#241408'); wall.addColorStop(1, '#1a0e05');
        c.fillStyle = wall; c.fillRect(0, 0, W, H);
        // Wooden planks
        c.strokeStyle = 'rgba(80,40,10,.4)'; c.lineWidth = 1;
        for (let y = 0; y < H; y += H * .06) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
        // Fireplace (left side)
        const fpx = W * .12, fpy = H * .72;
        c.fillStyle = '#100a05'; c.fillRect(fpx - 40, fpy - H * .28, 80, H * .28);
        c.fillStyle = '#0a0605'; c.fillRect(fpx - 30, fpy - H * .22, 60, H * .2);
        // Fire glow
        const fg = c.createRadialGradient(fpx, fpy, 0, fpx, fpy, 60);
        fg.addColorStop(0, 'rgba(255,100,20,.6)'); fg.addColorStop(.5, 'rgba(255,60,10,.15)'); fg.addColorStop(1, 'rgba(255,60,10,0)');
        c.fillStyle = fg; c.fillRect(fpx - 60, fpy - 60, 120, 80);
        // Flickering flames
        for (let i = 0; i < 3; i++) {
          const fx = fpx + (i - 1) * 12, fh = 18 + Math.sin(Date.now() * .003 + i) * 8;
          c.beginPath(); c.moveTo(fx - 8, fpy); c.quadraticCurveTo(fx, fpy - fh * .6, fx + 8, fpy);
          c.fillStyle = `rgba(255,${120 + i * 20},0,.8)`; c.fill();
        }
        // Counter / bar
        c.fillStyle = '#2a1805'; c.fillRect(W * .55, H * .5, W * .42, H * .5);
        c.fillStyle = '#3a2010'; c.fillRect(W * .52, H * .48, W * .46, H * .06);
        // Tankards on bar
        for (let i = 0; i < 3; i++) {
          const tx = W * (.58 + i * .12), ty = H * .5;
          c.fillStyle = '#6a4820'; c.fillRect(tx, ty - 24, 16, 22); c.fillStyle = '#ffd080'; c.fillRect(tx + 2, ty - 24, 12, 6);
        }
        // Window (back wall)
        c.fillStyle = '#060a14'; c.fillRect(W * .35, H * .1, W * .14, H * .2);
        c.strokeStyle = '#3a2010'; c.lineWidth = 5; c.strokeRect(W * .35, H * .1, W * .14, H * .2);
        // Ambient warm glow
        const ag = c.createRadialGradient(fpx, fpy, 0, fpx, fpy, W * .4);
        ag.addColorStop(0, 'rgba(200,80,20,.08)'); ag.addColorStop(1, 'rgba(200,80,20,0)');
        c.fillStyle = ag; c.fillRect(0, 0, W, H);
        // Floor
        const fl = c.createLinearGradient(0, H * .72, 0, H);
        fl.addColorStop(0, '#1a1005'); fl.addColorStop(1, '#100a03');
        c.fillStyle = fl; c.fillRect(0, H * .72, W, H * .28);
      },
      drawSchool(W, H) {
        const c = this.ctx;
        // Daytime sky
        const sky = c.createLinearGradient(0, 0, 0, H * .55);
        sky.addColorStop(0, '#2a6ab0'); sky.addColorStop(.6, '#5090d0'); sky.addColorStop(1, '#8ab8e8');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Sun
        c.beginPath(); c.arc(W * .82, H * .12, 26, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,240,150,.9)'; c.fill();
        // Clouds
        [[.15, .18], [.45, .12], [.68, .2]].forEach(([x, y]) => {
          c.fillStyle = 'rgba(255,255,255,.85)';
          [[0, 0, 28], [-22, 8, 20], [22, 8, 20], [-10, 14, 16], [10, 14, 16]].forEach(([dx, dy, r]) => {
            c.beginPath(); c.arc(x * W + dx, y * H + dy, r, 0, Math.PI * 2); c.fill();
          });
        });
        // School building (back)
        c.fillStyle = '#c04820'; c.fillRect(W * .2, H * .25, W * .6, H * .45);
        c.fillStyle = '#a03818'; c.fillRect(W * .2, H * .18, W * .6, H * .1);
        // Roof triangle
        c.beginPath(); c.moveTo(W * .2, H * .25); c.lineTo(W * .5, H * .1); c.lineTo(W * .8, H * .25); c.closePath();
        c.fillStyle = '#802808'; c.fill();
        // Windows
        for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
          const wx = W * (.27 + col * .14), wy = H * (.3 + row * .14);
          c.fillStyle = '#c8e8f8'; c.fillRect(wx, wy, W * .09, H * .08);
          c.strokeStyle = '#802808'; c.lineWidth = 2; c.strokeRect(wx, wy, W * .09, H * .08);
          c.beginPath(); c.moveTo(wx + W * .045, wy); c.lineTo(wx + W * .045, wy + H * .08); c.stroke();
        }
        // Door
        c.fillStyle = '#4a2808'; c.fillRect(W * .44, H * .56, W * .12, H * .14);
        // Flag pole
        c.strokeStyle = '#888'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * .5, H * .1); c.lineTo(W * .5, H * .0); c.stroke();
        c.fillStyle = '#e02020'; c.fillRect(W * .5, H * .0, W * .06, H * .04);
        // Ground
        const grd = c.createLinearGradient(0, H * .7, 0, H);
        grd.addColorStop(0, '#3a8030'); grd.addColorStop(.4, '#2a6020'); grd.addColorStop(1, '#1a4010');
        c.fillStyle = grd; c.fillRect(0, H * .7, W, H * .3);
      },
      drawOffice(W, H) {
        const c = this.ctx;
        // Interior bg
        c.fillStyle = '#0e1218'; c.fillRect(0, 0, W, H);
        // Ceiling with fluorescent lights
        c.fillStyle = '#151c24'; c.fillRect(0, 0, W, H * .12);
        for (let i = 0; i < 4; i++) {
          const lx = W * (.1 + i * .26);
          const lg = c.createRadialGradient(lx, H * .06, 0, lx, H * .06, 50);
          lg.addColorStop(0, 'rgba(220,240,255,.35)'); lg.addColorStop(1, 'rgba(220,240,255,0)');
          c.fillStyle = lg; c.fillRect(0, 0, W, H * .25);
          c.fillStyle = 'rgba(220,240,255,.7)'; c.fillRect(lx - 20, H * .02, 40, H * .03);
        }
        // Back wall with windows
        c.fillStyle = '#0a1018'; c.fillRect(0, H * .12, W, H * .5);
        // Window (showing city at night)
        const wx = W * .3, wy = H * .15, ww = W * .4, wh = H * .35;
        c.fillStyle = '#020810'; c.fillRect(wx, wy, ww, wh);
        // City lights in window
        for (let i = 0; i < 20; i++) {
          const bx = wx + (i * 89 % (ww - 20)), by = wy + H * .05 + (i * 61 % (wh - H * .1));
          c.fillStyle = `rgba(255,${200 + i * 3 % 55},${100 + i * 7 % 100},.${3 + i % 5})`;
          c.fillRect(bx, by, 4 + i % 8, 6 + i % 12);
        }
        c.strokeStyle = '#1a2030'; c.lineWidth = 4; c.strokeRect(wx, wy, ww, wh);
        // Desk (foreground)
        c.fillStyle = '#1a2028'; c.fillRect(0, H * .6, W, H * .12);
        c.fillStyle = '#141c22'; c.fillRect(0, H * .72, W, H * .28);
        // Monitor
        const mx = W * .42;
        c.fillStyle = '#0a0e14'; c.fillRect(mx, H * .38, W * .16, H * .22);
        c.fillStyle = '#0d3060'; c.fillRect(mx + 4, H * .4, W * .16 - 8, H * .18);
        // Screen glow
        const sg = c.createRadialGradient(mx + W * .08, H * .49, 0, mx + W * .08, H * .49, 60);
        sg.addColorStop(0, 'rgba(0,100,200,.2)'); sg.addColorStop(1, 'rgba(0,100,200,0)');
        c.fillStyle = sg; c.fillRect(mx - 20, H * .38, W * .16 + 40, H * .3);
        // Monitor stand
        c.fillStyle = '#0a0e14'; c.fillRect(mx + W * .06, H * .6, W * .04, H * .04);
        c.fillRect(mx + W * .03, H * .63, W * .1, H * .015);
        // Keyboard
        c.fillStyle = '#151c24'; c.fillRect(mx - W * .05, H * .64, W * .26, H * .04);
        // Floor
        c.fillStyle = '#0a0e14'; c.fillRect(0, H * .72, W, H * .28);
        // Ambient blue glow
        const ag = c.createRadialGradient(mx + W * .08, H * .49, 0, mx + W * .08, H * .49, W * .3);
        ag.addColorStop(0, 'rgba(0,60,140,.06)'); ag.addColorStop(1, 'rgba(0,60,140,0)');
        c.fillStyle = ag; c.fillRect(0, 0, W, H);
      },
      drawGarden(W, H) {
        const c = this.ctx;
        // Sky
        const sky = c.createLinearGradient(0, 0, 0, H * .5);
        sky.addColorStop(0, '#4090d8'); sky.addColorStop(.6, '#70b8f0'); sky.addColorStop(1, '#a8d8f8');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Sun
        const sg = c.createRadialGradient(W * .15, H * .1, 0, W * .15, H * .1, 35);
        sg.addColorStop(0, 'rgba(255,250,180,1)'); sg.addColorStop(.5, 'rgba(255,230,100,.6)'); sg.addColorStop(1, 'rgba(255,200,50,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(W * .15, H * .1, 35, 0, Math.PI * 2); c.fill();
        // Clouds
        [[.4, .12], [.7, .08], [.25, .2]].forEach(([x, y]) => {
          c.fillStyle = 'rgba(255,255,255,.88)';
          [[0, 0, 24], [-18, 6, 18], [18, 6, 18], [-8, 12, 14], [8, 12, 14]].forEach(([dx, dy, r]) => {
            c.beginPath(); c.arc(x * W + dx, y * H + dy, r, 0, Math.PI * 2); c.fill();
          });
        });
        // Far trees row
        c.fillStyle = '#2a6820';
        for (let i = 0; i <= 8; i++) {
          const tx = W * (i / 8), th = H * (.22 + Math.sin(i * 1.7) * .08);
          c.beginPath(); c.moveTo(tx, H * .5); c.lineTo(tx - W * .04, H * .5); c.lineTo(tx, H * .5 - th); c.lineTo(tx + W * .04, H * .5); c.closePath(); c.fill();
        }
        // Grass field
        const grass = c.createLinearGradient(0, H * .5, 0, H);
        grass.addColorStop(0, '#3a9030'); grass.addColorStop(.3, '#2a7020'); grass.addColorStop(1, '#1a5010');
        c.fillStyle = grass; c.fillRect(0, H * .5, W, H * .5);
        // Flower path
        c.strokeStyle = 'rgba(200,180,120,.4)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(W * .4, H); c.quadraticCurveTo(W * .48, H * .72, W * .5, H * .55); c.stroke();
        // Flowers
        const flowerColors = ['#ff6080', '#ffb020', '#80d0ff', '#ff80c0', '#a0ff60'];
        for (let i = 0; i < 30; i++) {
          const fx = (i * 97 + 11) % W, fy = H * .52 + (i * 61) % (H * .45);
          const fc = flowerColors[i % flowerColors.length];
          c.fillStyle = fc; c.beginPath(); c.arc(fx, fy, 4, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#ffe050'; c.beginPath(); c.arc(fx, fy, 2, 0, Math.PI * 2); c.fill();
        }
        // Fence
        c.strokeStyle = '#8a6040'; c.lineWidth = 2;
        for (let i = 0; i < W; i += 22) {
          c.beginPath(); c.moveTo(i, H * .7); c.lineTo(i, H * .78); c.stroke();
          c.beginPath(); c.moveTo(i + 4, H * .68); c.lineTo(i + 4, H * .76); c.stroke();
        }
        c.beginPath(); c.moveTo(0, H * .72); c.lineTo(W, H * .72); c.stroke();
        c.beginPath(); c.moveTo(0, H * .76); c.lineTo(W, H * .76); c.stroke();
      },
      drawDesert(W, H) {
        const c = this.ctx;
        // Scorched sky
        const sky = c.createLinearGradient(0, 0, 0, H * .55);
        sky.addColorStop(0, '#1a0808'); sky.addColorStop(.3, '#3a1408'); sky.addColorStop(.65, '#d06010'); sky.addColorStop(1, '#e88030');
        c.fillStyle = sky; c.fillRect(0, 0, W, H);
        // Blazing sun (huge, low)
        const sx = W * .5, sy = H * .38;
        const sg = c.createRadialGradient(sx, sy, 0, sx, sy, 80);
        sg.addColorStop(0, 'rgba(255,220,100,1)'); sg.addColorStop(.4, 'rgba(255,140,20,.8)'); sg.addColorStop(1, 'rgba(255,60,0,0)');
        c.beginPath(); c.arc(sx, sy, 80, 0, Math.PI * 2); c.fillStyle = sg; c.fill();
        // Heat shimmer lines
        c.strokeStyle = 'rgba(255,120,20,.06)'; c.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const hy = H * (.5 + i * .04);
          c.beginPath(); c.moveTo(0, hy);
          for (let x = 0; x < W; x += 20) c.quadraticCurveTo(x + 10, hy + Math.sin(x * .04 + Date.now() * .0008 + i) * 3, x + 20, hy);
          c.stroke();
        }
        // Sand dunes (layered)
        [[.82, '#b07828', 1.2], [.75, '#c08838', 1.0], [.7, '#d09848', .9]].forEach(([yBase, col, amp]) => {
          c.fillStyle = col;
          c.beginPath(); c.moveTo(0, H);
          for (let x = 0; x <= W; x += W / 10) c.quadraticCurveTo(x + W / 20, H * yBase + Math.sin(x * .005) * H * .04 * amp, x + W / 10, H * yBase + Math.cos(x * .003) * H * .03 * amp);
          c.lineTo(W, H); c.closePath(); c.fill();
        });
        // Cacti
        for (let i = 0; i < 3; i++) {
          const cx = W * (.15 + i * .38), cy = H * .7;
          c.fillStyle = '#2a6010';
          c.fillRect(cx - 5, cy - H * .18, 10, H * .18);
          c.fillRect(cx - 18, cy - H * .12, 10, H * .07);
          c.fillRect(cx + 8, cy - H * .1, 10, H * .06);
        }
        // Dry bones/skull hint
        c.strokeStyle = 'rgba(220,200,160,.3)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(W * .78, H * .76, 8, 0, Math.PI * 2); c.stroke();
      },
      start(name) {
        this.name = name;
        this.aiMode = false;
        if (this.raf) cancelAnimationFrame(this.raf);

        const aiBg = document.getElementById('ai-bg-layer');
        const aiLd = document.getElementById('ai-loading');
        aiBg.style.backgroundImage = '';
        aiBg.classList.remove('loaded');
        if (aiLd) { aiLd.classList.add('show'); }

        const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
        loop();

        AIBackground.fetch(name)
          .then(url => {
            if (url) {
              aiBg.style.backgroundImage = `url(${url})`;
              aiBg.classList.add('loaded');
              this.aiMode = true;
            }
            if (aiLd) aiLd.classList.remove('show');
          });
      },

      _drawAtmosphere(W, H) {
        const c = this.ctx;
        c.clearRect(0, 0, W, H);
        const n = (this.name || '').toLowerCase();

        if (/forest|garden|mountain|meadow|park/.test(n)) {
          this._fog(W, H, .10);
        }

        if (/space|cosmos|galaxy/.test(n)) {
          for (let i = 0; i < 18; i++) {
            const x = (i * 113 + (Date.now() * .00004 * (i % 3 + 1))) % W;
            const y = (i * 77) % (H * .55);
            c.beginPath(); c.arc(x, y, .9, 0, Math.PI * 2);
            c.fillStyle = `rgba(200,220,255,${.25 + Math.sin(Date.now() * .001 + i) * .18})`; c.fill();
          }
        }

        /* Stage floor shadow */
        const fl = c.createLinearGradient(0, H * .72, 0, H);
        fl.addColorStop(0, 'rgba(0,0,0,.42)'); fl.addColorStop(1, 'rgba(0,0,0,.72)');
        c.fillStyle = fl; c.fillRect(0, H * .72, W, H * .28);

        /* Stage line */
        c.beginPath(); c.moveTo(0, H * .74); c.lineTo(W, H * .74);
        c.strokeStyle = 'rgba(0,201,177,.07)'; c.lineWidth = 1; c.stroke();

        /* Vignette */
        const vig = c.createRadialGradient(W / 2, H / 2, H * .15, W / 2, H / 2, W * .72);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.5)');
        c.fillStyle = vig; c.fillRect(0, 0, W, H);
      }
    };

    /* ──────────────────────────────────────────
       CHARACTER ASSETS
    ────────────────────────────────────────── */
    const EMOTES = { neutral: '😐', happy: '😄', sad: '😢', angry: '😠', scared: '😨', thinking: '🤔', surprised: '😲', laughing: '😂', love: '😍', confused: '😕', evil: '😈', tired: '😴' };

    function heroSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="20" ry="3.5" fill="rgba(0,0,0,.4)"/>
    <rect x="25" y="82" width="11" height="26" rx="5.5" fill="${c.body}"/>
    <rect x="40" y="82" width="11" height="26" rx="5.5" fill="${c.body}"/>
    <rect x="23" y="100" width="15" height="7.5" rx="3.8" fill="#10101e"/>
    <rect x="38" y="100" width="15" height="7.5" rx="3.8" fill="#10101e"/>
    <rect x="18" y="49" width="40" height="36" rx="7.5" fill="${c.body}"/>
    <rect x="16" y="77" width="44" height="6" rx="3" fill="${c.acc}" opacity=".8"/>
    <rect x="35" y="76" width="6" height="7" rx="1" fill="${c.acc}"/>
    <rect x="6" y="51" width="13" height="30" rx="5.5" fill="${c.body}"/>
    <rect x="57" y="51" width="13" height="30" rx="5.5" fill="${c.body}"/>
    <ellipse cx="12.5" cy="83" rx="6" ry="5.5" fill="${c.skin}"/>
    <ellipse cx="63.5" cy="83" rx="6" ry="5.5" fill="${c.skin}"/>
    <rect x="30" y="41" width="16" height="12" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="34" rx="19.5" ry="21" fill="${c.skin}"/>
    <path d="M18.5 24 Q18.5 9 38 9 Q57.5 9 57.5 24 Q57.5 17 38 15 Q18.5 17 18.5 24 Z" fill="#2a180c"/>
    <ellipse cx="30.5" cy="32" rx="3.8" ry="4.8" fill="white"/>
    <ellipse cx="45.5" cy="32" rx="3.8" ry="4.8" fill="white"/>
    <circle cx="31.5" cy="33" r="2.8" fill="${c.iris}"/>
    <circle cx="46.5" cy="33" r="2.8" fill="${c.iris}"/>
    <circle cx="32" cy="32" r="1.5" fill="#050a12"/>
    <circle cx="47" cy="32" r="1.5" fill="#050a12"/>
    <circle cx="32.5" cy="31.5" r=".75" fill="white"/>
    <circle cx="47.5" cy="31.5" r=".75" fill="white"/>
    <path d="M32 42 Q38 46 44 42" stroke="#7a3e20" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M28 57 L38 50 L48 57 L38 62 Z" fill="${c.acc}" opacity=".55"/>
  </svg>`;
    }

    function villainSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="20" ry="3.5" fill="rgba(0,0,0,.55)"/>
    <path d="M13 52 Q5 74 8 110 L38 107 L68 110 Q71 74 63 52 Z" fill="#130008" opacity=".92"/>
    <rect x="26" y="85" width="10" height="22" rx="5" fill="#2a0a12"/>
    <rect x="40" y="85" width="10" height="22" rx="5" fill="#2a0a12"/>
    <rect x="20" y="49" width="36" height="39" rx="7" fill="${c.body}"/>
    <path d="M20 49 Q13 57 10 87 L17 89 Q18 65 20 55 Z" fill="#130008"/>
    <path d="M56 49 Q63 57 66 87 L59 89 Q58 65 56 55 Z" fill="#130008"/>
    <path d="M26 53 L38 49 L50 53 L46 72 L38 76 L30 72 Z" fill="${c.acc}" opacity=".35"/>
    <path d="M32 57 L38 53 L44 57 L38 67 Z" fill="${c.acc}" opacity=".55"/>
    <rect x="7" y="51" width="13" height="33" rx="5.5" fill="${c.body}"/>
    <rect x="56" y="51" width="13" height="33" rx="5.5" fill="${c.body}"/>
    <rect x="5" y="75" width="17" height="11" rx="4" fill="#130008"/>
    <rect x="54" y="75" width="17" height="11" rx="4" fill="#130008"/>
    <rect x="30" y="41" width="16" height="12" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="33" rx="19.5" ry="21" fill="${c.skin}"/>
    <path d="M18.5 22 Q20 6 38 4 Q56 6 57.5 22 L57.5 29 Q56 14 38 12 Q20 14 18.5 29 Z" fill="#080005"/>
    <path d="M16 30 Q14 20 18.5 16 L20.5 27 Z" fill="#080005"/>
    <path d="M60 30 Q62 20 57.5 16 L55.5 27 Z" fill="#080005"/>
    <ellipse cx="30" cy="32" rx="3.8" ry="4.8" fill="#18000a"/>
    <ellipse cx="46" cy="32" rx="3.8" ry="4.8" fill="#18000a"/>
    <circle cx="30" cy="32" r="2.8" fill="${c.acc}"/>
    <circle cx="46" cy="32" r="2.8" fill="${c.acc}"/>
    <circle cx="30" cy="32" r="1.5" fill="#ff001a"/>
    <circle cx="46" cy="32" r="1.5" fill="#ff001a"/>
    <circle cx="30" cy="32" r="4.5" fill="${c.acc}" opacity=".12"/>
    <circle cx="46" cy="32" r="4.5" fill="${c.acc}" opacity=".12"/>
    <path d="M30 44 Q38 50 46 44" stroke="${c.acc}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <line x1="32" y1="44" x2="32" y2="46" stroke="${c.acc}" stroke-width=".9" opacity=".7"/>
    <line x1="44" y1="44" x2="44" y2="46" stroke="${c.acc}" stroke-width=".9" opacity=".7"/>
  </svg>`;
    }

    function wizardSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="20" ry="3.5" fill="rgba(0,0,0,.4)"/>
    <path d="M15 52 Q10 80 12 110 L38 107 L64 110 Q66 80 61 52 Z" fill="${c.body}"/>
    <path d="M20 52 L38 48 L56 52 L52 78 L38 84 L24 78 Z" fill="${c.acc}" opacity=".25"/>
    <rect x="7" y="54" width="12" height="32" rx="5.5" fill="${c.body}"/>
    <rect x="57" y="54" width="12" height="32" rx="5.5" fill="${c.body}"/>
    <ellipse cx="13" cy="88" rx="5.5" ry="5" fill="${c.skin}"/>
    <line x1="63" y1="58" x2="63" y2="98" stroke="${c.acc}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="63" cy="52" r="7" fill="${c.acc}" opacity=".8"/>
    <circle cx="63" cy="52" r="4" fill="white" opacity=".5"/>
    <rect x="30" y="42" width="16" height="12" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="34" rx="19" ry="20" fill="${c.skin}"/>
    <path d="M19 22 Q20 0 38 2 Q56 0 57 22 Q52 10 38 8 Q24 10 19 22 Z" fill="#1a0840"/>
    <path d="M19 22 L14 16 L38 -2 L62 16 L57 22 Z" fill="#240c58"/>
    <circle cx="14" cy="16" r="4" fill="${c.acc}"/>
    <ellipse cx="30" cy="32" rx="3.8" ry="4.5" fill="white"/>
    <ellipse cx="46" cy="32" rx="3.8" ry="4.5" fill="white"/>
    <circle cx="30.5" cy="33" r="2.8" fill="${c.iris}"/>
    <circle cx="46.5" cy="33" r="2.8" fill="${c.iris}"/>
    <circle cx="31" cy="32" r="1.4" fill="#050a12"/>
    <circle cx="47" cy="32" r="1.4" fill="#050a12"/>
    <circle cx="31.5" cy="31.5" r=".7" fill="white"/>
    <circle cx="47.5" cy="31.5" r=".7" fill="white"/>
    <path d="M32 43 Q38 47 44 43" stroke="#7a3e20" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M28 27 Q38 23 48 27" stroke="#b0a0c0" stroke-width="1" fill="none"/>
  </svg>`;
    }

    function knightSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="22" ry="3.5" fill="rgba(0,0,0,.5)"/>
    <rect x="22" y="85" width="12" height="25" rx="3" fill="#1a1e28"/>
    <rect x="42" y="85" width="12" height="25" rx="3" fill="#1a1e28"/>
    <rect x="20" y="97" width="16" height="10" rx="2" fill="${c.acc}" opacity=".7"/>
    <rect x="40" y="97" width="16" height="10" rx="2" fill="${c.acc}" opacity=".7"/>
    <rect x="18" y="48" width="40" height="40" rx="5" fill="#222838"/>
    <path d="M18 48 Q18 44 38 42 Q58 44 58 48 L58 56 Q38 52 18 56 Z" fill="#1a1e28"/>
    <rect x="34" y="76" width="8" height="12" rx="2" fill="#1a1e28"/>
    <rect x="6" y="50" width="13" height="34" rx="5" fill="#222838"/>
    <rect x="57" y="50" width="13" height="34" rx="5" fill="#222838"/>
    <rect x="5" y="78" width="15" height="9" rx="3" fill="#1a1e28"/>
    <rect x="56" y="78" width="15" height="9" rx="3" fill="#1a1e28"/>
    <rect x="66" y="50" width="4" height="38" rx="2" fill="${c.acc}"/>
    <rect x="63" y="54" width="10" height="3" rx="1" fill="${c.acc}" opacity=".8"/>
    <rect x="30" y="40" width="16" height="10" rx="3" fill="#222838"/>
    <ellipse cx="38" cy="32" rx="18" ry="19" fill="#222838"/>
    <rect x="22" y="22" width="32" height="14" rx="5" fill="#1a1e28"/>
    <rect x="26" y="24" width="24" height="10" rx="3" fill="#0a0e18"/>
    <ellipse cx="30.5" cy="32" rx="3.5" ry="4" fill="white"/>
    <ellipse cx="45.5" cy="32" rx="3.5" ry="4" fill="white"/>
    <circle cx="31" cy="33" r="2.5" fill="${c.iris}"/>
    <circle cx="46" cy="33" r="2.5" fill="${c.iris}"/>
    <circle cx="31.5" cy="32" r="1.3" fill="#050a12"/>
    <circle cx="46.5" cy="32" r="1.3" fill="#050a12"/>
    <rect x="36" y="38" width="4" height="5" rx="2" fill="${c.skin}"/>
    <path d="M32 43 Q38 47 44 43" stroke="${c.acc}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M22 56 Q38 60 54 56" stroke="${c.acc}" stroke-width="1" fill="none" opacity=".5"/>
  </svg>`;
    }

    function scholarSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="18" ry="3.5" fill="rgba(0,0,0,.4)"/>
    <rect x="26" y="82" width="10" height="26" rx="5" fill="${c.body}"/>
    <rect x="40" y="82" width="10" height="26" rx="5" fill="${c.body}"/>
    <rect x="22" y="48" width="32" height="36" rx="6" fill="${c.body}"/>
    <rect x="10" y="50" width="13" height="28" rx="5.5" fill="${c.body}"/>
    <rect x="53" y="50" width="13" height="28" rx="5.5" fill="${c.body}"/>
    <ellipse cx="16.5" cy="80" rx="5.5" ry="5" fill="${c.skin}"/>
    <rect x="54" y="60" width="10" height="14" rx="2" fill="#c8a060"/>
    <rect x="55" y="61" width="8" height="12" rx="1" fill="#f0e0b0"/>
    <rect x="30" y="40" width="16" height="10" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="32" rx="18" ry="19" fill="${c.skin}"/>
    <path d="M20 24 Q20 10 38 10 Q56 10 56 24 Q54 16 38 14 Q22 16 20 24 Z" fill="#2a1408"/>
    <ellipse cx="29" cy="32" rx="4.5" ry="4" fill="rgba(200,230,255,.15)" stroke="#a0c0e0" stroke-width="1"/>
    <ellipse cx="47" cy="32" rx="4.5" ry="4" fill="rgba(200,230,255,.15)" stroke="#a0c0e0" stroke-width="1"/>
    <line x1="33.5" y1="32" x2="42.5" y2="32" stroke="#a0c0e0" stroke-width=".8"/>
    <ellipse cx="29" cy="32" rx="3" ry="3" fill="white"/>
    <ellipse cx="47" cy="32" rx="3" ry="3" fill="white"/>
    <circle cx="29.5" cy="32.5" r="2" fill="${c.iris}"/>
    <circle cx="47.5" cy="32.5" r="2" fill="${c.iris}"/>
    <circle cx="30" cy="32" r="1" fill="#050a12"/>
    <circle cx="48" cy="32" r="1" fill="#050a12"/>
    <path d="M33 42 Q38 45 43 42" stroke="#7a3e20" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <rect x="24" y="55" width="28" height="3" rx="1.5" fill="${c.acc}" opacity=".4"/>
    <rect x="26" y="61" width="24" height="2.5" rx="1" fill="${c.acc}" opacity=".3"/>
    <rect x="26" y="66" width="20" height="2.5" rx="1" fill="${c.acc}" opacity=".2"/>
  </svg>`;
    }

    function elderSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="18" ry="3.5" fill="rgba(0,0,0,.4)"/>
    <rect x="26" y="82" width="10" height="26" rx="5" fill="${c.body}"/>
    <rect x="40" y="82" width="10" height="26" rx="5" fill="${c.body}"/>
    <rect x="20" y="48" width="36" height="36" rx="7" fill="${c.body}"/>
    <rect x="10" y="52" width="12" height="28" rx="5.5" fill="${c.body}"/>
    <rect x="54" y="52" width="12" height="28" rx="5.5" fill="${c.body}"/>
    <ellipse cx="16" cy="82" rx="5" ry="4.5" fill="${c.skin}"/>
    <ellipse cx="60" cy="82" rx="5" ry="4.5" fill="${c.skin}"/>
    <line x1="56" y1="60" x2="56" y2="110" stroke="#8a7060" stroke-width="3" stroke-linecap="round"/>
    <circle cx="56" cy="58" r="5" fill="#a08070" opacity=".8"/>
    <rect x="30" y="40" width="16" height="10" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="31" rx="17" ry="18" fill="${c.skin}"/>
    <path d="M21 21 Q22 8 38 9 Q54 8 55 21 Q50 14 38 13 Q26 14 21 21 Z" fill="#f0f0f0"/>
    <path d="M18 22 Q18 14 22 14 Q20 20 21 22 Z" fill="#e8e8e8"/>
    <path d="M58 22 Q58 14 54 14 Q56 20 55 22 Z" fill="#e8e8e8"/>
    <ellipse cx="29.5" cy="31" rx="3.5" ry="4.2" fill="white"/>
    <ellipse cx="46.5" cy="31" rx="3.5" ry="4.2" fill="white"/>
    <circle cx="30" cy="32" r="2.5" fill="${c.iris}"/>
    <circle cx="47" cy="32" r="2.5" fill="${c.iris}"/>
    <circle cx="30.5" cy="31.5" r="1.2" fill="#050a12"/>
    <circle cx="47.5" cy="31.5" r="1.2" fill="#050a12"/>
    <path d="M30 40 Q38 37 46 40" stroke="#c8a090" stroke-width=".8" fill="none"/>
    <path d="M28 44 Q38 49 48 44" stroke="#9a6a50" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M24 32 Q20 35 22 40" stroke="#e0d0b0" stroke-width="1.5" fill="none"/>
    <path d="M52 32 Q56 35 54 40" stroke="#e0d0b0" stroke-width="1.5" fill="none"/>
  </svg>`;
    }

    function merchantSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="22" ry="3.5" fill="rgba(0,0,0,.4)"/>
    <rect x="24" y="82" width="12" height="26" rx="5.5" fill="${c.body}"/>
    <rect x="40" y="82" width="12" height="26" rx="5.5" fill="${c.body}"/>
    <rect x="18" y="48" width="40" height="38" rx="7" fill="${c.body}"/>
    <rect x="30" y="78" width="16" height="8" rx="2" fill="${c.acc}" opacity=".5"/>
    <rect x="8" y="50" width="12" height="30" rx="5.5" fill="${c.body}"/>
    <rect x="56" y="50" width="12" height="30" rx="5.5" fill="${c.body}"/>
    <ellipse cx="14" cy="82" rx="5.5" ry="5" fill="${c.skin}"/>
    <rect x="56" y="55" width="14" height="18" rx="3" fill="#8a6030"/>
    <rect x="57" y="56" width="12" height="16" rx="2" fill="#b08040"/>
    <circle cx="63" cy="58" r="2" fill="#d0a050"/>
    <circle cx="63" cy="62" r="1.5" fill="#d0a050" opacity=".6"/>
    <rect x="30" y="40" width="16" height="12" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="33" rx="19" ry="20" fill="${c.skin}"/>
    <path d="M19 24 Q20 8 38 8 Q56 8 57 24 Q55 16 38 15 Q21 16 19 24 Z" fill="#3a2010"/>
    <ellipse cx="30" cy="33" rx="3.8" ry="4.5" fill="white"/>
    <ellipse cx="46" cy="33" rx="3.8" ry="4.5" fill="white"/>
    <circle cx="30.5" cy="34" r="2.8" fill="${c.iris}"/>
    <circle cx="46.5" cy="34" r="2.8" fill="${c.iris}"/>
    <circle cx="31" cy="33" r="1.4" fill="#050a12"/>
    <circle cx="47" cy="33" r="1.4" fill="#050a12"/>
    <circle cx="31.5" cy="32.5" r=".7" fill="white"/>
    <circle cx="47.5" cy="32.5" r=".7" fill="white"/>
    <path d="M33 44 Q38 48 43 44" stroke="#7a3e20" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <rect x="22" y="56" width="32" height="4" rx="2" fill="${c.acc}" opacity=".6"/>
  </svg>`;
    }

    function childSVG(c) {
      return `<svg viewBox="0 0 76 114" fill="none">
    <ellipse cx="38" cy="110" rx="16" ry="3" fill="rgba(0,0,0,.4)"/>
    <rect x="28" y="78" width="9" height="28" rx="4.5" fill="${c.body}"/>
    <rect x="39" y="78" width="9" height="28" rx="4.5" fill="${c.body}"/>
    <rect x="22" y="100" width="14" height="7" rx="3.5" fill="#10101e"/>
    <rect x="38" y="100" width="14" height="7" rx="3.5" fill="#10101e"/>
    <rect x="20" y="46" width="36" height="35" rx="8" fill="${c.body}"/>
    <rect x="30" y="74" width="16" height="6" rx="2" fill="${c.acc}" opacity=".5"/>
    <rect x="10" y="48" width="11" height="26" rx="5" fill="${c.body}"/>
    <rect x="55" y="48" width="11" height="26" rx="5" fill="${c.body}"/>
    <ellipse cx="15.5" cy="75" rx="4.5" ry="4" fill="${c.skin}"/>
    <ellipse cx="60.5" cy="75" rx="4.5" ry="4" fill="${c.skin}"/>
    <rect x="31" y="37" width="14" height="11" rx="4" fill="${c.skin}"/>
    <ellipse cx="38" cy="29" rx="17" ry="18.5" fill="${c.skin}"/>
    <path d="M21 20 Q22 7 38 8 Q54 7 55 20 Q52 12 38 11 Q24 12 21 20 Z" fill="#2a1808"/>
    <ellipse cx="30" cy="29" rx="4" ry="4.8" fill="white"/>
    <ellipse cx="46" cy="29" rx="4" ry="4.8" fill="white"/>
    <circle cx="30.5" cy="30" r="3" fill="${c.iris}"/>
    <circle cx="46.5" cy="30" r="3" fill="${c.iris}"/>
    <circle cx="31" cy="29" r="1.6" fill="#050a12"/>
    <circle cx="47" cy="29" r="1.6" fill="#050a12"/>
    <circle cx="31.5" cy="28.5" r=".8" fill="white"/>
    <circle cx="47.5" cy="28.5" r=".8" fill="white"/>
    <circle cx="38" cy="36" r="2.5" fill="${c.skin}" opacity=".6"/>
    <path d="M33 39 Q38 43 43 39" stroke="#c07848" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <path d="M26 55 L38 48 L50 55 L38 59 Z" fill="${c.acc}" opacity=".4"/>
  </svg>`;
    }

    function charStyle(name, idx) {
      const lc = name.toLowerCase();

      // Villain archetypes
      if (/villain|enemy|dark|evil|shadow|demon|witch|monster|beast|ghost|undead|necromancer|sorcerer/.test(lc))
        return { type: 'villain', colors: { body: '#3d0d1f', acc: '#ff4d6d', skin: '#c07060', iris: '#ff4d6d' }, nameColor: '#ff4d6d' };

      // Wizard / Mage archetype
      if (/wizard|mage|sorcerer|witch(?!er)|enchant|arcane|mystic|magician|spellcaster/.test(lc))
        return { type: 'wizard', colors: { body: '#1a0840', acc: '#b07aff', skin: '#d4a880', iris: '#8050d0' }, nameColor: '#b07aff' };

      // Knight / Warrior archetype
      if (/knight|warrior|soldier|guard|paladin|fighter|captain|armor|champion/.test(lc))
        return { type: 'knight', colors: { body: '#1a2030', acc: '#60a0d0', skin: '#d4966a', iris: '#3060a0' }, nameColor: '#60b8ff' };

      // Scholar / Professor / Doctor
      if (/scholar|professor|doctor|scientist|teacher|sage|academic|historian|doctor/.test(lc))
        return { type: 'scholar', colors: { body: '#102040', acc: '#4080c0', skin: '#deb880', iris: '#2050a0' }, nameColor: '#60a8e0' };

      // Elder / Grandparent
      if (/elder|old|grand|ancient|sage|veteran|retired|senior/.test(lc))
        return { type: 'elder', colors: { body: '#2a1808', acc: '#c0a050', skin: '#d4a080', iris: '#4a3020' }, nameColor: '#d0b060' };

      // Merchant / Trader
      if (/merchant|trader|shopkeeper|vendor|seller|dealer|blacksmith|tailor/.test(lc))
        return { type: 'merchant', colors: { body: '#2a1808', acc: '#c88040', skin: '#d4a060', iris: '#604020' }, nameColor: '#d09840' };

      // Child
      if (/child|kid|boy|girl|young|youth|little|small|baby/.test(lc))
        return { type: 'child', colors: { body: '#0a3060', acc: '#60c0ff', skin: '#f0b880', iris: '#2870b0' }, nameColor: '#60c8ff' };

      // Default hero palettes
      const palettes = [
        { body: '#0d4060', acc: '#00c9b1', skin: '#d4966a', iris: '#1a6080', nameColor: '#00c9b1' },
        { body: '#1a3d0f', acc: '#4ae06a', skin: '#d4a060', iris: '#1a6020', nameColor: '#4ae06a' },
        { body: '#2d0a50', acc: '#b07aff', skin: '#c88868', iris: '#5040a0', nameColor: '#b07aff' },
        { body: '#3a1000', acc: '#ff8040', skin: '#d49060', iris: '#804020', nameColor: '#ff9050' },
        { body: '#001a30', acc: '#40c8ff', skin: '#d4b080', iris: '#0060a0', nameColor: '#50d0ff' },
      ];
      return { type: 'hero', colors: palettes[idx % palettes.length], nameColor: palettes[idx % palettes.length].nameColor };
    }

    /* ──────────────────────────────────────────
       PARSIA ENGINE
    ────────────────────────────────────────── */
    class ParsiaEngine {
      constructor() {
        this.chars = {}; this.actions = []; this.idx = 0;
        this.running = false; this.speed = 1; this.story = null;
        this._curIdx = 0;
      }
      ms(base) { return base / this.speed; }

      load(json) {
        this._clearStage();
        this.story = json; this.idx = 0;
        json.characters.forEach((name, i) => {
          const def = charStyle(name, i);
          const el = document.createElement('div');
          el.className = 'char-el'; el.dataset.name = name;
          const svg = document.createElement('div');
          svg.className = 'char-svg';
          const svgFns = { villain: villainSVG, wizard: wizardSVG, knight: knightSVG, scholar: scholarSVG, elder: elderSVG, merchant: merchantSVG, child: childSVG };
          svg.innerHTML = (svgFns[def.type] || heroSVG)(def.colors);
          const em = document.createElement('div');
          em.className = 'char-emote'; em.textContent = '😐';
          svg.appendChild(em);
          const plate = document.createElement('div');
          plate.className = 'char-plate'; plate.textContent = name;
          plate.style.color = def.nameColor; plate.style.borderColor = def.nameColor + '28';
          el.appendChild(svg); el.appendChild(plate);
          document.getElementById('char-layer').appendChild(el);
          const xp = 28 + (i / (Math.max(json.characters.length - 1, 1))) * 44;
          el.style.left = xp + '%';
          this.chars[name] = { el, def, pos: xp, live: false, emotion: 'neutral', em };
        });
        this.actions = json.actions;
        this._buildQueue();
        this._syncUI();
        this._syncChars();
        document.getElementById('scene-val').textContent = json.scene || '—';
        document.getElementById('scene-lbl').textContent = 'SCENE: ' + (json.scene || '').toUpperCase();
        document.getElementById('scene-lbl').style.display = 'block';
        document.getElementById('empty').style.display = 'none';
        Scene.start(json.scene || 'Forest');
      }

      _clearStage() {
        document.getElementById('char-layer').innerHTML = '';
        document.getElementById('dlg-layer').innerHTML = '';
        this.chars = {};
      }

      get(name) { return this.chars[name] || this.chars[Object.keys(this.chars).find(k => k.toLowerCase() === name.toLowerCase())]; }
      wait(ms) { return new Promise(r => setTimeout(r, ms)); }

      async run(action) {
        switch (action.type) {
          case 'enter': await this._enter(action); break;
          case 'exit': await this._exit(action); break;
          case 'say': await this._say(action); break;
          case 'emote': await this._emote(action); break;
          case 'move': await this._move(action); break;
          case 'wait': await this._wait(action); break;
          case 'scene_change': await this._sceneChange(action); break;
        }
      }

      async _sceneChange({ scene }) {
        const fx = document.getElementById('scene-fx');
        this._killAllDlg();
        fx.classList.add('flash');
        await this.wait(this.ms(560));
        if (scene) {
          this.story.scene = scene;
          Scene.start(scene);
          document.getElementById('scene-val').textContent = scene;
          document.getElementById('scene-lbl').textContent = 'SCENE: ' + scene.toUpperCase();
          if (!AmbientAudio.muted) AmbientAudio.play(scene);
        }
        await this.wait(this.ms(400));
        fx.classList.remove('flash');
        await this.wait(this.ms(200));
      }

      async _enter({ who }) {
        const c = this.get(who); if (!c) return;
        c.live = true; c.el.classList.add('onstage');
        this._syncChars(); await this.wait(this.ms(550));
      }
      async _exit({ who }) {
        const c = this.get(who); if (!c) return;
        this._killDlg(who);
        c.el.classList.add('exiting'); c.el.classList.remove('onstage');
        await this.wait(this.ms(550));
        c.live = false; c.el.classList.remove('exiting');
        this._syncChars();
      }
      async _say({ who, text }) {
        const c = this.get(who); if (!c || !c.live) return;
        this._killDlg(who);
        const bub = document.createElement('div');
        bub.className = 'dlg'; bub.dataset.speaker = who;
        const px = c.pos;
        bub.style.left = Math.min(Math.max(px - 14, 2), 58) + '%';
        bub.style.bottom = (68 + 130) + 'px';
        const who_el = document.createElement('div'); who_el.className = 'dlg-who'; who_el.textContent = who;
        const txt_el = document.createElement('div'); txt_el.className = 'dlg-txt';
        const cur = document.createElement('span'); cur.className = 'dlg-cursor';
        bub.appendChild(who_el); bub.appendChild(txt_el); txt_el.appendChild(cur);
        document.getElementById('dlg-layer').appendChild(bub);
        for (let i = 0; i <= text.length; i++) {
          txt_el.textContent = text.slice(0, i); txt_el.appendChild(cur);
          await this.wait(this.ms(28));
          if (!this.running) break;
        }
        await this.wait(this.ms(Math.max(900, text.length * 48)));
        bub.style.transition = 'opacity .35s ease'; bub.style.opacity = '0';
        await this.wait(this.ms(380)); bub.remove();
      }
      async _emote({ who, emotion }) {
        const c = this.get(who); if (!c) return;
        c.emotion = emotion; c.em.textContent = EMOTES[emotion] || '❓';
        c.em.classList.remove('pop'); void c.em.offsetWidth; c.em.classList.add('pop');

        /* Phase 2: CSS glow classes on svg element */
        const svgEl = c.el.querySelector('.char-svg');
        if (svgEl) {
          svgEl.className = 'char-svg';
          if (emotion) svgEl.classList.add('glow-' + emotion);
        }

        /* Phase 2: body animation by emotion */
        const bodyAnims = {
          happy: 'bouncing',
          jump: 'jumping',
          wave: 'bouncing',
          scared: 'shaking',
          angry: 'shaking',
          surprised: 'bouncing',
        };
        const anim = bodyAnims[emotion];
        if (anim) {
          c.el.classList.remove('jumping', 'shaking', 'bouncing');
          void c.el.offsetWidth;
          c.el.classList.add(anim);
          setTimeout(() => c.el.classList.remove(anim), 750);
        }

        this._syncChars(); await this.wait(this.ms(400));
      }
      async _move({ who, dir, steps }) {
        const c = this.get(who); if (!c || !c.live) return;
        const d = (dir || '').toUpperCase(), s = steps || 1, px = 8 * s;
        c.el.classList.add('walking');
        if (d === 'LEFT' || d === 'RIGHT') {
          c.pos = Math.max(8, Math.min(92, c.pos + (d === 'LEFT' ? -px : px)));
          c.el.style.left = c.pos + '%';
        } else if (d === 'UP' || d === 'DOWN') {
          if (c.posY === undefined) c.posY = 0;
          c.posY = Math.max(-30, Math.min(60, c.posY + (d === 'UP' ? px * 1.5 : -px * 1.5)));
          c.el.style.bottom = (68 + c.posY) + 'px';
        }
        const bub = document.querySelector(`.dlg[data-speaker="${who}"]`);
        if (bub) bub.style.left = Math.min(Math.max(c.pos - 14, 2), 58) + '%';
        await this.wait(this.ms(680));
        c.el.classList.remove('walking');
        this._syncChars();
      }
      async _wait({ duration }) { await this.wait(this.ms((duration || 1) * 1000)); }

      _killDlg(who) { document.querySelectorAll(`.dlg[data-speaker="${who}"]`).forEach(b => b.remove()); }
      _killAllDlg() { document.getElementById('dlg-layer').innerHTML = ''; }

      /* Playback */
      async play() {
        if (this.running) return;
        this.running = true;
        document.getElementById('btn-play').textContent = '⏸';
        document.getElementById('status').textContent = 'PLAYING';
        try {
          while (this.idx < this.actions.length && this.running) {
            this._curIdx = this.idx;
            await this.run(this.actions[this.idx]);
            this.idx++; this._syncUI();
          }
        } catch (e) { }
        this.running = false;
        document.getElementById('btn-play').textContent = '▶';
        document.getElementById('status').textContent = this.idx >= this.actions.length ? 'DONE' : 'PAUSED';
      }
      pause() { this.running = false; document.getElementById('btn-play').textContent = '▶'; document.getElementById('status').textContent = 'PAUSED'; }
      async step() {
        if (this.running || this.idx >= this.actions.length) return;
        this._curIdx = this.idx; await this.run(this.actions[this.idx]); this.idx++; this._syncUI();
      }
      back() { this.idx = Math.max(0, this.idx - 1); this._softReset(); this._syncUI(); }
      _softReset() {
        Object.values(this.chars).forEach(c => {
          c.el.classList.remove('onstage', 'exiting'); c.live = false; c.emotion = 'neutral'; c.em.textContent = '😐';
          c.posY = 0; c.el.style.bottom = '68px';
          const s = c.el.querySelector('.char-svg'); if (s) s.style.filter = 'drop-shadow(0 10px 22px rgba(0,0,0,.65))';
        });
        this._killAllDlg(); this._syncChars();
      }
      fullReset() { this.running = false; this.idx = 0; this._softReset(); this._syncUI(); document.getElementById('btn-play').textContent = '▶'; document.getElementById('status').textContent = 'READY'; }

      /* UI sync */
      _syncUI() {
        const t = this.actions.length, n = this.idx;
        document.getElementById('pn-cur').textContent = n;
        document.getElementById('pn-tot').textContent = '/ ' + t;
        document.getElementById('prog-fill').style.width = (t > 0 ? (n / t * 100) : 0) + '%';
        document.querySelectorAll('.act-item').forEach((el, i) => {
          el.classList.toggle('done', i < n); el.classList.toggle('current', i === n);
        });
        const cur = document.querySelector('.act-item.current');
        if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const a = this.actions[n];
        document.getElementById('cur-action').innerHTML = a
          ? `<span style="color:var(--teal)">${a.type}</span>${a.who ? ` <span style="color:#60b8ff">${a.who}</span>` : ''}${a.text ? `<br><span style="color:var(--text-muted);font-style:italic">"${a.text}"</span>` : ''}${a.emotion ? ` <span style="color:#b07aff">${a.emotion}</span>` : ''}${a.dir ? ` <span style="color:#ffc000">${a.dir}×${a.steps}</span>` : ''}${a.duration ? ` <span style="color:#888">${a.duration}s</span>` : ''}`
          : 'End of story';
      }
      _syncChars() {
        const list = document.getElementById('char-list');
        list.innerHTML = '';
        document.getElementById('char-cnt').textContent = Object.keys(this.chars).length;
        Object.entries(this.chars).forEach(([name, c]) => {
          const card = document.createElement('div');
          card.className = 'char-card' + (c.live ? ' live' : '');
          card.innerHTML = `<div class="char-dot"></div><div class="char-card-name">${name}</div><div class="char-card-right"><span class="char-card-emote">${EMOTES[c.emotion] || '😐'}</span><span class="char-card-pos">${c.live ? Math.round(c.pos) + '%' : 'offstage'}</span></div>`;
          list.appendChild(card);
        });
      }
      _buildQueue() {
        const list = document.getElementById('action-list');
        list.innerHTML = '';
        const t = this.actions.length;
        document.getElementById('act-count').textContent = t + ' actions';
        const icons = { enter: '→', exit: '←', say: '💬', emote: '✨', move: '↔', wait: '⏱' };
        this.actions.forEach((a, i) => {
          const item = document.createElement('div');
          item.className = `act-item t-${a.type}`;
          let lbl = a.type.toUpperCase() + (a.who ? ' ' + a.who : '');
          let sub = a.text ? `"${a.text.slice(0, 26)}${a.text.length > 26 ? '…' : ''}"` : a.emotion || (a.dir ? `${a.dir}×${a.steps}` : '') + (a.duration ? `${a.duration}s` : '');
          item.innerHTML = `<span class="act-num">${String(i + 1).padStart(2, '0')}</span><span class="act-icon">${icons[a.type] || '?'}</span><div style="flex:1;min-width:0"><div class="act-label">${lbl}</div>${sub ? `<div class="act-sub">${sub}</div>` : ''}</div>`;
          item.addEventListener('click', () => { if (!engine.running) { engine.idx = i; engine._softReset(); engine._syncUI(); } });
          list.appendChild(item);
        });
      }
    }

    /* ──────────────────────────────────────────
       7-PHASE COMPILER PIPELINE (story_compiler.py port)
    ────────────────────────────────────────── */
    const TT = Object.freeze({
      NUMBER: 'NUMBER', STRING: 'STRING', IDENT: 'IDENT',
      SCENE: 'SCENE', CHARACTER: 'CHARACTER', ENTER: 'ENTER', EXIT: 'EXIT',
      SAY: 'SAY', MOVE: 'MOVE', WAIT: 'WAIT', EMOTE: 'EMOTE',
      TASK: 'TASK', DO: 'DO', IF: 'IF', ELSE: 'ELSE', LOOP: 'LOOP',
      REPEAT: 'REPEAT', RETURN: 'RETURN', LET: 'LET', SET: 'SET', PRINT: 'PRINT',
      LEFT: 'LEFT', RIGHT: 'RIGHT', UP: 'UP', DOWN: 'DOWN',
      PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH',
      EQ_EQ: 'EQ_EQ', BANG_EQ: 'BANG_EQ', LT: 'LT', GT: 'GT', LT_EQ: 'LT_EQ', GT_EQ: 'GT_EQ',
      AND: 'AND', OR: 'OR', NOT: 'NOT',
      ASSIGN: 'ASSIGN', COLON: 'COLON', LPAREN: 'LPAREN', RPAREN: 'RPAREN',
      COMMA: 'COMMA', NEWLINE: 'NEWLINE', INDENT: 'INDENT', DEDENT: 'DEDENT', EOF: 'EOF'
    });
    const KW_MAP = {
      SCENE: TT.SCENE, CHARACTER: TT.CHARACTER, ENTER: TT.ENTER, EXIT: TT.EXIT,
      SAY: TT.SAY, MOVE: TT.MOVE, WAIT: TT.WAIT, EMOTE: TT.EMOTE,
      task: TT.TASK, do: TT.DO, if: TT.IF, else: TT.ELSE, loop: TT.LOOP,
      repeat: TT.REPEAT, return: TT.RETURN, let: TT.LET, set: TT.SET, print: TT.PRINT,
      and: TT.AND, or: TT.OR, not: TT.NOT,
      LEFT: TT.LEFT, RIGHT: TT.RIGHT, UP: TT.UP, DOWN: TT.DOWN,
    };

    class StoryLexer {
      constructor(src) { this.src = src; this.tokens = []; this.iStack = [0]; }
      tokenize() {
        for (const raw of this.src.split('\n')) this._line(raw);
        while (this.iStack.length > 1) { this.iStack.pop(); this.tokens.push({ t: TT.DEDENT }); }
        this.tokens.push({ t: TT.EOF }); return this.tokens;
      }
      _line(raw) {
        const s = raw.trimEnd(), c = s.trimStart();
        if (!c || c[0] === '#') return;
        const ind = s.length - c.length, prev = this.iStack[this.iStack.length - 1];
        if (ind > prev) { this.iStack.push(ind); this.tokens.push({ t: TT.INDENT }); }
        else while (ind < this.iStack[this.iStack.length - 1]) { this.iStack.pop(); this.tokens.push({ t: TT.DEDENT }); }
        let i = 0;
        while (i < c.length) {
          const ch = c[i];
          if (ch === ' ' || ch === '\t') { i++; continue; }
          if (ch === '#') break;
          if (ch === '"') {
            let j = i + 1; while (j < c.length && c[j] !== '"') j++;
            this.tokens.push({ t: TT.STRING, v: c.slice(i + 1, j) }); i = j + 1; continue;
          }
          if (/\d/.test(ch) || (ch === '-' && i + 1 < c.length && /\d/.test(c[i + 1]))) {
            let j = i + (ch === '-' ? 1 : 0); while (j < c.length && /[\d.]/.test(c[j])) j++;
            this.tokens.push({ t: TT.NUMBER, v: parseFloat(c.slice(i, j)) }); i = j; continue;
          }
          if (/[a-zA-Z_]/.test(ch)) {
            let j = i; while (j < c.length && /\w/.test(c[j])) j++;
            const w = c.slice(i, j); this.tokens.push({ t: KW_MAP[w] || TT.IDENT, v: w }); i = j; continue;
          }
          const two = c.slice(i, i + 2);
          const twos = { '==': TT.EQ_EQ, '!=': TT.BANG_EQ, '<=': TT.LT_EQ, '>=': TT.GT_EQ };
          if (twos[two]) { this.tokens.push({ t: twos[two], v: two }); i += 2; continue; }
          const ones = {
            '+': TT.PLUS, '-': TT.MINUS, '*': TT.STAR, '/': TT.SLASH,
            '<': TT.LT, '>': TT.GT, '=': TT.ASSIGN, ':': TT.COLON, '(': TT.LPAREN, ')': TT.RPAREN
          };
          if (ones[ch]) { this.tokens.push({ t: ones[ch], v: ch }); i++; continue; }
          i++;
        }
        this.tokens.push({ t: TT.NEWLINE });
      }
    }

    class StoryParser {
      constructor(toks) { this.toks = toks; this.pos = 0; }
      cur() { return this.toks[this.pos] || { t: TT.EOF }; }
      peek(n = 1) { return this.toks[this.pos + n] || { t: TT.EOF }; }
      adv() { return this.toks[this.pos++] || { t: TT.EOF }; }
      exp(t) { if (this.cur().t !== t) throw new Error(`Expected ${t} got ${this.cur().t}('${this.cur().v || ''}')`); return this.adv(); }
      nl() { while (this.cur().t === TT.NEWLINE) this.adv(); }
      match(...ts) { return ts.includes(this.cur().t); }
      parse() { const b = []; this.nl(); while (!this.match(TT.EOF)) { const s = this.stmt(); if (s) b.push(s); this.nl(); } return { type: 'Program', body: b }; }
      block() { const s = []; this.exp(TT.INDENT); this.nl(); while (!this.match(TT.DEDENT, TT.EOF)) { const st = this.stmt(); if (st) s.push(st); this.nl(); } if (this.match(TT.DEDENT)) this.adv(); return s; }
      end() { while (this.cur().t === TT.NEWLINE) this.adv(); }
      stmt() {
        this.nl(); const t = this.cur();
        if (t.t === TT.NEWLINE) { this.adv(); return null; }
        if (t.t === TT.SCENE) { this.adv(); const n = this.exp(TT.IDENT).v; this.end(); return { type: 'Scene', name: n }; }
        if (t.t === TT.CHARACTER) { this.adv(); const n = this.exp(TT.IDENT).v; this.end(); return { type: 'Character', name: n }; }
        if (t.t === TT.TASK) { this.adv(); const n = this.exp(TT.IDENT).v; this.exp(TT.COLON); this.end(); return { type: 'Task', name: n, body: this.block() }; }
        if (t.t === TT.ENTER) { this.adv(); const n = this.exp(TT.IDENT).v; this.end(); return { type: 'Enter', char: n }; }
        if (t.t === TT.EXIT) { this.adv(); const n = this.exp(TT.IDENT).v; this.end(); return { type: 'Exit', char: n }; }
        if (t.t === TT.WAIT) { this.adv(); const d = this.expr(); this.end(); return { type: 'Wait', dur: d }; }
        if (t.t === TT.DO) { this.adv(); const n = this.exp(TT.IDENT).v; this.end(); return { type: 'Do', task: n }; }
        if (t.t === TT.LET) { this.adv(); const n = this.exp(TT.IDENT).v; this.exp(TT.ASSIGN); const v = this.expr(); this.end(); return { type: 'Let', name: n, value: v }; }
        if (t.t === TT.SET) { this.adv(); const n = this.exp(TT.IDENT).v; this.exp(TT.ASSIGN); const v = this.expr(); this.end(); return { type: 'Set', name: n, value: v }; }
        if (t.t === TT.PRINT) { this.adv(); const v = this.expr(); this.end(); return { type: 'Print', value: v }; }
        if (t.t === TT.IF) {
          this.adv(); const cond = this.expr(); this.exp(TT.COLON); this.end();
          const then = this.block(); let els = [];
          this.nl(); if (this.match(TT.ELSE)) { this.adv(); this.exp(TT.COLON); this.end(); els = this.block(); }
          return { type: 'If', cond, then, else: els };
        }
        if (t.t === TT.LOOP) { this.adv(); const c = this.expr(); this.exp(TT.COLON); this.end(); return { type: 'Loop', count: c, body: this.block() }; }
        if (t.t === TT.REPEAT) {
          this.adv(); this.exp(TT.COLON); this.end(); const body = this.block(); this.nl();
          if (this.cur().t === TT.IDENT && this.cur().v === 'until') { this.adv(); const c = this.expr(); this.end(); return { type: 'Repeat', body, cond: c }; }
          return { type: 'Repeat', body, cond: { type: 'Lit', v: false } };
        }
        if (t.t === TT.RETURN) { this.adv(); const v = this.expr(); this.end(); return { type: 'Return', value: v }; }
        if (t.t === TT.IDENT && this.peek().t === TT.SAY) { const c = this.adv().v; this.adv(); const tx = this.exp(TT.STRING).v; this.end(); return { type: 'Say', char: c, text: tx }; }
        if (t.t === TT.IDENT && this.peek().t === TT.MOVE) { const c = this.adv().v; this.adv(); const d = this.adv(); const s = this.expr(); this.end(); return { type: 'Move', char: c, dir: d.v, steps: s }; }
        if (t.t === TT.IDENT && this.peek().t === TT.EMOTE) { const c = this.adv().v; this.adv(); const e = this.exp(TT.IDENT).v; this.end(); return { type: 'Emote', char: c, emotion: e }; }
        throw new Error(`Unexpected token: ${t.t}('${t.v || ''}')`);
      }
      get PREC() { return { [TT.OR]: 1, [TT.AND]: 2, [TT.EQ_EQ]: 3, [TT.BANG_EQ]: 3, [TT.LT]: 4, [TT.GT]: 4, [TT.LT_EQ]: 4, [TT.GT_EQ]: 4, [TT.PLUS]: 5, [TT.MINUS]: 5, [TT.STAR]: 6, [TT.SLASH]: 6 }; }
      expr(min = 0) { let l = this.unary(); while (this.PREC[this.cur().t] > min) { const op = this.adv(); l = { type: 'BinOp', op: op.v || op.t, left: l, right: this.expr(this.PREC[op.t]) }; } return l; }
      unary() { if (this.match(TT.NOT, TT.MINUS)) { const op = this.adv(); return { type: 'Unary', op: op.v || op.t, val: this.unary() }; } return this.primary(); }
      primary() {
        const t = this.cur();
        if (t.t === TT.NUMBER) { this.adv(); return { type: 'Lit', v: t.v }; }
        if (t.t === TT.STRING) { this.adv(); return { type: 'Lit', v: t.v }; }
        if (t.t === TT.IDENT) { this.adv(); return { type: 'Var', name: t.v }; }
        throw new Error(`Expected expression, got ${t.t}`);
      }
    }

    class StorySemantic {
      constructor() { this.chars = {}; this.vars = {}; this.tasks = new Set(); this.warns = []; this.inTask = false; }
      analyse(prog) {
        for (const n of prog.body) if (n.type === 'Task') this.tasks.add(n.name);
        for (const n of prog.body) this._v(n);
      }
      _v(n) { if (!n) return; const fn = this['_v' + n.type]; if (fn) fn.call(this, n); else this._vc(n); }
      _vc(n) { for (const v of Object.values(n)) if (v && typeof v === 'object') { if (Array.isArray(v)) v.forEach(c => this._v(c)); else if (v.type) this._v(v); } }
      _vScene() { } _vCharacter(n) { if (this.chars[n.name]) throw new Error(`'${n.name}' already declared`); this.chars[n.name] = { on: false }; }
      _vTask(n) { const p = this.inTask; this.inTask = true; for (const s of n.body) this._v(s); this.inTask = p; }
      _vEnter(n) { if (!this.chars[n.char]) throw new Error(`'${n.char}' not declared`); if (!this.inTask) { if (this.chars[n.char].on) this.warns.push(`'${n.char}' already on stage`); this.chars[n.char].on = true; } }
      _vExit(n) { if (!this.chars[n.char]) throw new Error(`'${n.char}' not declared`); if (!this.inTask) { if (!this.chars[n.char].on) this.warns.push(`'${n.char}' exits but wasn't on stage`); this.chars[n.char].on = false; } }
      _vSay(n) { if (!this.chars[n.char]) throw new Error(`'${n.char}' not declared`); if (!this.inTask && !this.chars[n.char].on) throw new Error(`'${n.char}' speaks but hasn't entered`); }
      _vMove(n) { if (!this.chars[n.char]) throw new Error(`'${n.char}' not declared`); if (!this.inTask && !this.chars[n.char].on) throw new Error(`'${n.char}' moves but hasn't entered`); }
      _vEmote(n) { if (!this.chars[n.char]) throw new Error(`'${n.char}' not declared`); }
      _vLet(n) { if (this.vars[n.name]) throw new Error(`'${n.name}' already declared`); this.vars[n.name] = true; }
      _vSet(n) { if (!this.vars[n.name]) throw new Error(`'${n.name}' not declared (use let)`); }
      _vDo(n) { if (!this.tasks.has(n.task)) throw new Error(`Undefined task '${n.task}'`); }
      _vIf(n) { this._v(n.cond); n.then.forEach(s => this._v(s)); n.else.forEach(s => this._v(s)); }
      _vLoop(n) { this._v(n.count); n.body.forEach(s => this._v(s)); }
      _vRepeat(n) { n.body.forEach(s => this._v(s)); this._v(n.cond); }
      _vPrint() { } _vReturn() { } _vWait() { }
    }

    class StoryIRGen {
      constructor() { this.ins = []; this._t = 0; this._lc = 0; }
      tmp() { return `_t${++this._t}`; } lbl() { return `L${++this._lc}`; }
      e(op, dst, src1, src2) { this.ins.push({ op, dst, src1, src2 }); }
      generate(prog) {
        const tasks = prog.body.filter(n => n.type === 'Task');
        const rest = prog.body.filter(n => n.type !== 'Task');
        for (const t of tasks) this._task(t);
        this.e('SECTION', null, 'main');
        for (const n of rest) this._emit(n);
        this.e('HALT'); return this.ins;
      }
      _emit(n) { const fn = this['_l' + n.type]; if (fn) fn.call(this, n); else throw new Error(`No IR for ${n.type}`); }
      _task(n) { this.e('FUNC_BEGIN', null, n.name); for (const s of n.body) this._emit(s); this.e('FUNC_END', null, n.name); }
      _lTask(n) { this._task(n); }
      _lScene(n) { this.e('SET_SCENE', null, n.name); }
      _lCharacter(n) { this.e('DECL_CHAR', null, n.name); }
      _lEnter(n) { this.e('ENTER', null, n.char); }
      _lExit(n) { this.e('EXIT', null, n.char); }
      _lSay(n) { this.e('SAY', null, n.char, n.text); }
      _lEmote(n) { this.e('EMOTE', null, n.char, n.emotion); }
      _lMove(n) { const s = this._e(n.steps); this.e('MOVE', s, n.char, n.dir); }
      _lWait(n) { const d = this._e(n.dur); this.e('WAIT', null, d); }
      _lDo(n) { this.e('CALL', null, n.task); }
      _lLet(n) { const v = this._e(n.value); this.e('STORE', n.name, v); }
      _lSet(n) { const v = this._e(n.value); this.e('STORE', n.name, v); }
      _lPrint(n) { const v = this._e(n.value); this.e('PRINT', null, v); }
      _lReturn(n) { const v = this._e(n.value); this.e('RETURN', null, v); }
      _lIf(n) { const c = this._e(n.cond); const el = this.lbl(), end = this.lbl(); this.e('JMP_FALSE', el, c); for (const s of n.then) this._emit(s); this.e('JMP', end); this.e('LABEL', null, el); for (const s of n.else) this._emit(s); this.e('LABEL', null, end); }
      _lLoop(n) {
        const c = this._e(n.count), iv = this.tmp(), z = this.tmp(), lb = this.lbl(), end = this.lbl();
        this.e('LOAD_CONST', z, 0); this.e('STORE', iv, z); this.e('LABEL', null, lb);
        const cmp = this.tmp(); this.e('BINOP', cmp, iv, [c, '<']); this.e('JMP_FALSE', end, cmp);
        for (const s of n.body) this._emit(s);
        const one = this.tmp(), inc = this.tmp(); this.e('LOAD_CONST', one, 1); this.e('BINOP', inc, iv, [one, '+']); this.e('STORE', iv, inc); this.e('JMP', lb); this.e('LABEL', null, end);
      }
      _lRepeat(n) { const lb = this.lbl(); this.e('LABEL', null, lb); for (const s of n.body) this._emit(s); const c = this._e(n.cond); this.e('JMP_FALSE', lb, c); }
      _e(expr) {
        if (expr.type === 'Lit') { const t = this.tmp(); this.e('LOAD_CONST', t, expr.v); return t; }
        if (expr.type === 'Var') { const t = this.tmp(); this.e('LOAD_VAR', t, expr.name); return t; }
        if (expr.type === 'BinOp') { const l = this._e(expr.left), r = this._e(expr.right), t = this.tmp(); this.e('BINOP', t, l, [r, expr.op]); return t; }
        if (expr.type === 'Unary') { const v = this._e(expr.val), t = this.tmp(); this.e('UNOP', t, v, expr.op); return t; }
        const t = this.tmp(); this.e('LOAD_CONST', t, 0); return t;
      }
    }

    class StoryOptimizer {
      run(ins) { ins = this._cf(ins); ins = this._dse(ins); return ins; }
      _cf(ins) {
        const cm = {}; const out = [];
        for (const i of ins) {
          if (i.op === 'LOAD_CONST') { cm[i.dst] = i.src1; out.push(i); }
          else if (i.op === 'BINOP') {
            const [rT, op] = i.src2; const lv = cm[i.src1], rv = cm[rT];
            if (typeof lv === 'number' && typeof rv === 'number') {
              const f = this._fold(lv, rv, op);
              if (f !== null) { cm[i.dst] = f; out.push({ op: 'LOAD_CONST', dst: i.dst, src1: f, src2: null }); continue; }
            } out.push(i);
          } else out.push(i);
        } return out;
      }
      _fold(a, b, op) {
        if (op === '+') return a + b; if (op === '-') return a - b;
        if (op === '*') return a * b; if (op === '/' && b !== 0) return a / b;
        if (op === '<') return a < b ? 1 : 0; if (op === '>') return a > b ? 1 : 0;
        if (op === '==') return a === b ? 1 : 0; return null;
      }
      _dse(ins) {
        const used = new Set();
        for (const i of ins) {
          if (typeof i.src1 === 'string' && i.src1.startsWith('_t')) used.add(i.src1);
          if (Array.isArray(i.src2) && typeof i.src2[0] === 'string' && i.src2[0].startsWith('_t')) used.add(i.src2[0]);
          else if (typeof i.src2 === 'string' && i.src2.startsWith('_t')) used.add(i.src2);
          if (i.op === 'MOVE' && typeof i.dst === 'string' && i.dst.startsWith('_t')) used.add(i.dst);
          if (i.op === 'STORE' && typeof i.src1 === 'string' && i.src1.startsWith('_t')) used.add(i.src1);
        }
        return ins.filter(i => {
          if (['LOAD_CONST', 'BINOP', 'UNOP', 'LOAD_VAR'].includes(i.op) && i.dst && i.dst.startsWith('_t') && !used.has(i.dst)) return false;
          return true;
        });
      }
    }

    class StoryCodeGen {
      constructor() { this.actions = []; this.env = {}; this.scene = null; this.chars = {}; this.tasks = {}; this.ret = null; }
      execute(ins) {
        let i = 0;
        while (i < ins.length) {
          if (ins[i].op === 'FUNC_BEGIN') {
            const nm = ins[i].src1; const b = []; i++;
            while (i < ins.length && !(ins[i].op === 'FUNC_END' && ins[i].src1 === nm)) { b.push(ins[i]); i++; }
            this.tasks[nm] = b;
          }
          i++;
        }
        const main = []; let inMain = false;
        for (const x of ins) {
          if (x.op === 'SECTION' && x.src1 === 'main') { inMain = true; continue; }
          if (inMain && x.op !== 'FUNC_BEGIN' && x.op !== 'FUNC_END') main.push(x);
        }
        this._run(main);
        return {
          scene: this.scene, characters: Object.keys(this.chars), actions: this.actions,
          metadata: { compiler: 'Parsia v1.0', actionCount: this.actions.length, characterCount: Object.keys(this.chars).length }
        };
      }
      _run(ins) {
        const lm = {}; ins.forEach((x, i) => { if (x.op === 'LABEL') lm[x.src1] = i; });
        let ip = 0;
        while (ip < ins.length) {
          const x = ins[ip++];
          if (['HALT', 'FUNC_BEGIN', 'FUNC_END'].includes(x.op)) break;
          if (['SECTION', 'LABEL'].includes(x.op)) continue;
          if (x.op === 'SET_SCENE') this.scene = x.src1;
          else if (x.op === 'DECL_CHAR') this.chars[x.src1] = false;
          else if (x.op === 'ENTER') { this.chars[x.src1] = true; this.actions.push({ type: 'enter', who: x.src1 }); }
          else if (x.op === 'EXIT') { this.chars[x.src1] = false; this.actions.push({ type: 'exit', who: x.src1 }); }
          else if (x.op === 'SAY') this.actions.push({ type: 'say', who: x.src1, text: x.src2 });
          else if (x.op === 'EMOTE') this.actions.push({ type: 'emote', who: x.src1, emotion: x.src2 });
          else if (x.op === 'MOVE') { const s = Math.round(this._r(x.dst)); this.actions.push({ type: 'move', who: x.src1, dir: x.src2, steps: s }); }
          else if (x.op === 'WAIT') this.actions.push({ type: 'wait', duration: parseFloat(this._r(x.src1)) || 1 });
          else if (x.op === 'LOAD_CONST') this.env[x.dst] = x.src1;
          else if (x.op === 'LOAD_VAR') this.env[x.dst] = this.env[x.src1] ?? 0;
          else if (x.op === 'STORE') this.env[x.dst] = this._r(x.src1);
          else if (x.op === 'BINOP') { const [rT, op] = x.src2; this.env[x.dst] = this._op(this._r(x.src1), this._r(rT), op); }
          else if (x.op === 'UNOP') { const v = this._r(x.src1); this.env[x.dst] = x.src2 === '-' ? -v : !v; }
          else if (x.op === 'PRINT') console.log(this._r(x.src1));
          else if (x.op === 'JMP') ip = lm[x.dst];
          else if (x.op === 'JMP_FALSE') { if (!this._r(x.src1)) ip = lm[x.dst]; }
          else if (x.op === 'CALL') this._call(x.src1);
          else if (x.op === 'RETURN') { this.ret = this._r(x.src1); return; }
        }
      }
      _call(name) { if (!this.tasks[name]) throw new Error(`Task '${name}' not found`); const s = this.ret; this.ret = null; this._run(this.tasks[name]); this.ret = s; }
      _r(k) { if (typeof k === 'number') return k; if (typeof k === 'string' && k in this.env) return this.env[k]; return k || 0; }
      _op(a, b, op) {
        if (op === '+') return a + b; if (op === '-') return a - b; if (op === '*') return a * b; if (op === '/' && b !== 0) return a / b;
        if (op === '==') return a === b ? 1 : 0; if (op === '!=') return a !== b ? 1 : 0;
        if (op === '<') return a < b ? 1 : 0; if (op === '>') return a > b ? 1 : 0;
        if (op === '<=') return a <= b ? 1 : 0; if (op === '>=') return a >= b ? 1 : 0;
        if (op === 'and') return (a && b) ? 1 : 0; if (op === 'or') return (a || b) ? 1 : 0;
        return 0;
      }
    }

    function compileStory(src) {
      const log = [];
      const line = (cls, msg) => log.push({ cls, msg });
      try {
        line('co-hd', '═══ Parsia Compiler v1.0 ═══'); line('co-dim', '');
        line('co-dim', '▶ Phase 1 — Lexical Analysis');
        const tokens = new StoryLexer(src).tokenize();
        line('co-ok', `   ✓ ${tokens.length} tokens`);
        line('co-dim', '▶ Phase 2/3 — Parsing');
        const ast = new StoryParser(tokens).parse();
        line('co-ok', `   ✓ ${ast.body.length} AST nodes`);
        line('co-dim', '▶ Phase 4 — Semantic Analysis');
        const sem = new StorySemantic(); sem.analyse(ast);
        sem.warns.forEach(w => line('co-warn', `   ⚠ ${w}`));
        line('co-ok', `   ✓ ${Object.keys(sem.chars).length} chars, ${sem.tasks.size} tasks`);
        line('co-dim', '▶ Phase 5 — IR Generation');
        const ir = new StoryIRGen().generate(ast);
        line('co-ok', `   ✓ ${ir.length} IR instructions`);
        line('co-dim', '▶ Phase 6 — Optimization');
        const irOpt = new StoryOptimizer().run(ir);
        line('co-ok', `   ✓ ${ir.length} → ${irOpt.length} instructions`);
        line('co-dim', '▶ Phase 7 — Code Generation');
        const output = new StoryCodeGen().execute(irOpt);
        line('co-ok', `   ✓ ${output.actions.length} animation actions`);
        line('co-ok', ''); line('co-ok', '✅ Compilation successful!');
        return { ok: true, output, log };
      } catch (e) {
        line('co-err', `❌ ${e.message}`);
        return { ok: false, log };
      }
    }

    /* ══════════════════════════════════════════
       PHASE 2 — AI BACKGROUND SYSTEM
    ══════════════════════════════════════════ */
    const AIBackground = {
      cache: {},

      _prompt(sceneName) {
        const n = sceneName.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase().trim();
        return `2D cartoon animation background scene, ${n}, professional studio animation art, `
          + `flat illustration style, establishing wide shot, rich vibrant colors, `
          + `no characters, no text, no watermark, studio ghibli inspired quality`;
      },

      _seed(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
        return Math.abs(h) % 999983;
      },

      fetch(sceneName) {
        if (this.cache[sceneName]) return Promise.resolve(this.cache[sceneName]);
        const prompt = encodeURIComponent(this._prompt(sceneName));
        const seed = this._seed(sceneName);
        const url = `https://image.pollinations.ai/prompt/${prompt}?width=1280&height=720&nologo=true&seed=${seed}`;
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { this.cache[sceneName] = url; resolve(url); };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      }
    };

    /* ══════════════════════════════════════════
       PHASE 2 — AMBIENT AUDIO SYSTEM
    ══════════════════════════════════════════ */
    const AmbientAudio = {
      actx: null, masterGain: null, nodes: [], muted: true,

      _init() {
        if (this.actx) return;
        this.actx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.actx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.actx.destination);
      },

      stop() {
        this.nodes.forEach(n => {
          try { n.disconnect(); if (n.stop) n.stop(); } catch (e) { }
        });
        this.nodes = [];
      },

      play(sceneName) {
        this._init();
        this.stop();
        if (this.muted) return;

        const n = (sceneName || '').toLowerCase();
        const base = n.includes('castle') || n.includes('dungeon') ? 55 :
          n.includes('space') || n.includes('cosmos') ? 40 :
            n.includes('beach') || n.includes('ocean') ? 70 :
              n.includes('city') || n.includes('town') ? 60 :
                n.includes('tavern') ? 65 : 80;

        const osc1 = this.actx.createOscillator();
        osc1.type = 'sine'; osc1.frequency.value = base;
        const g1 = this.actx.createGain(); g1.gain.value = 0.55;
        osc1.connect(g1); g1.connect(this.masterGain); osc1.start();

        const osc2 = this.actx.createOscillator();
        osc2.type = 'triangle'; osc2.frequency.value = base * 1.5;
        const g2 = this.actx.createGain(); g2.gain.value = 0.18;
        osc2.connect(g2); g2.connect(this.masterGain); osc2.start();

        const osc3 = this.actx.createOscillator();
        osc3.type = 'sine'; osc3.frequency.value = base * 3.98;
        const g3 = this.actx.createGain(); g3.gain.value = 0.06;
        osc3.connect(g3); g3.connect(this.masterGain); osc3.start();

        this.nodes.push(osc1, osc2, osc3, g1, g2, g3);

        if (/forest|beach|garden|mountain|meadow|park/.test(n)) {
          this._addNoise(0.045, 350);
        }
      },

      _addNoise(vol, cutoff) {
        const sr = this.actx.sampleRate;
        const buf = this.actx.createBuffer(1, sr * 2, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.actx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const flt = this.actx.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = cutoff;
        const g = this.actx.createGain(); g.gain.value = vol;
        src.connect(flt); flt.connect(g); g.connect(this.masterGain);
        src.start();
        this.nodes.push(src, flt, g);
      },

      toggle() {
        this._init();
        this.muted = !this.muted;
        if (this.actx.state === 'suspended') this.actx.resume();
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.14, this.actx.currentTime, 0.3);
        return this.muted;
      }
    };

    /* ══════════════════════════════════════════
       PHASE 2 — SHARE LINK SYSTEM
    ══════════════════════════════════════════ */
    const ShareLink = {
      encode(animationJson) {
        try {
          const str = JSON.stringify(animationJson);
          return btoa(unescape(encodeURIComponent(str)));
        } catch (e) { return null; }
      },

      decode(b64) {
        try {
          return JSON.parse(decodeURIComponent(escape(atob(b64))));
        } catch (e) { return null; }
      },

      copy(animationJson) {
        const b64 = this.encode(animationJson);
        if (!b64) return false;
        const url = location.origin + location.pathname + '#s=' + b64;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).catch(() => this._fallback(url));
        } else {
          this._fallback(url);
        }
        return true;
      },

      _fallback(url) {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove();
      },

      checkHash() {
        const hash = location.hash;
        if (!hash.startsWith('#s=')) return null;
        return this.decode(hash.slice(3));
      }
    };

    /* ──────────────────────────────────────────
       INIT & EVENTS
    ────────────────────────────────────────── */
    const engine = new ParsiaEngine();
    Scene.init(document.getElementById('scene-canvas'));

    /* Global toast (used before Supabase module loads) */
    function showToastGlobal(msg, type) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toast-msg');
      const toastIcon = document.getElementById('toast-icon');
      if (!toast) return;
      toastMsg.textContent = msg;
      toastIcon.textContent = type === 'ok' ? '✓' : '✕';
      toast.className = 'show ' + (type || 'ok');
      clearTimeout(showToastGlobal._t);
      showToastGlobal._t = setTimeout(() => { toast.className = ''; }, 3200);
    }

    const DEMO = { "scene": "Forest", "characters": ["Hero", "Villain"], "actions": [{ "type": "enter", "who": "Hero" }, { "type": "say", "who": "Hero", "text": "Where am I..." }, { "type": "emote", "who": "Hero", "emotion": "thinking" }, { "type": "wait", "duration": 1 }, { "type": "enter", "who": "Villain" }, { "type": "emote", "who": "Villain", "emotion": "angry" }, { "type": "say", "who": "Villain", "text": "You shouldn't be here." }, { "type": "emote", "who": "Hero", "emotion": "scared" }, { "type": "move", "who": "Hero", "dir": "LEFT", "steps": 2 }, { "type": "wait", "duration": 1 }, { "type": "move", "who": "Villain", "dir": "RIGHT", "steps": 2 }, { "type": "say", "who": "Villain", "text": "You can't escape." }, { "type": "say", "who": "Hero", "text": "Watch me!" }, { "type": "move", "who": "Hero", "dir": "LEFT", "steps": 1 }, { "type": "move", "who": "Hero", "dir": "LEFT", "steps": 1 }, { "type": "emote", "who": "Hero", "emotion": "happy" }, { "type": "say", "who": "Hero", "text": "Freedom!" }, { "type": "exit", "who": "Hero" }, { "type": "exit", "who": "Villain" }] };

    function doLoad(json) {
      const fx = document.getElementById('scene-fx');
      fx.classList.add('flash');
      setTimeout(() => {
        engine.load(json);
        fx.classList.remove('flash');
        /* Phase 2: start ambient audio if sound is on */
        if (!AmbientAudio.muted) AmbientAudio.play(json.scene || 'Forest');
        /* Phase 3: populate animation editor */
        AnimEditor.populate(json);
      }, 560);
    }

    /* ── Phase 2: Share button ── */
    document.getElementById('btn-share').addEventListener('click', () => {
      if (!engine.story) { showToastGlobal('Load an animation first', 'err'); return; }
      const ok = ShareLink.copy(engine.story);
      if (ok) showToastGlobal('Share link copied to clipboard ✓', 'ok');
      else showToastGlobal('Copy failed — try manually', 'err');
    });

    /* ── Phase 2: Sound button ── */
    document.getElementById('btn-sound').addEventListener('click', () => {
      const muted = AmbientAudio.toggle();
      const btn = document.getElementById('btn-sound');
      btn.textContent = muted ? '🔇' : '🔊';
      btn.classList.toggle('on', !muted);
      if (!muted && engine.story) AmbientAudio.play(engine.story.scene || 'Forest');
    });

    /* ── Phase 2: Load from share link on page load ── */
    (function () {
      const shared = ShareLink.checkHash();
      if (shared && shared.actions) {
        setTimeout(() => {
          doLoad(shared);
          history.replaceState(null, '', location.pathname);
        }, 800);
      }
    })();

    document.getElementById('btn-demo').addEventListener('click', () => doLoad(DEMO));
    document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-in').click());
    document.getElementById('file-in').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = ev => { try { doLoad(JSON.parse(ev.target.result)) } catch (er) { alert('Invalid JSON: ' + er.message) } };
      r.readAsText(f); e.target.value = '';
    });

    // Drag & drop
    document.addEventListener('dragover', e => { e.preventDefault(); document.getElementById('drop-overlay').classList.add('show'); });
    document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.getElementById('drop-overlay').classList.remove('show'); });
    document.addEventListener('drop', e => {
      e.preventDefault(); document.getElementById('drop-overlay').classList.remove('show');
      const f = e.dataTransfer.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = ev => { try { doLoad(JSON.parse(ev.target.result)) } catch (er) { alert('Invalid JSON') } }; r.readAsText(f);
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      if (!engine.story) { doLoad(DEMO); setTimeout(() => engine.play(), 620); return; }
      engine.running ? engine.pause() : engine.play();
    });
    document.getElementById('btn-rst').addEventListener('click', () => engine.fullReset());
    document.getElementById('btn-fwd').addEventListener('click', () => engine.step());
    document.getElementById('btn-bk').addEventListener('click', () => engine.back());
    document.getElementById('spd').addEventListener('input', e => {
      engine.speed = parseFloat(e.target.value);
      document.getElementById('spd-val').textContent = engine.speed + '×';
    });
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); document.getElementById('btn-play').click(); }
      if (e.code === 'ArrowRight' && e.shiftKey) engine.step();
      if (e.code === 'ArrowLeft' && e.shiftKey) engine.back();
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyR') { e.preventDefault(); engine.fullReset(); }
    });

    // Inspector tab switching
    document.querySelectorAll('.ins-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ins-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ins-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('ins-' + btn.dataset.tab).classList.add('active');
      });
    });

    /* ── PHASE 3: ANIMATION EDITOR ─────────────────────── */
    const AnimEditor = {
      actions: [],

      populate(json) {
        this.actions = json && json.actions ? JSON.parse(JSON.stringify(json.actions)) : [];
        this.render();
      },

      render() {
        const list = document.getElementById('ed-list');
        if (!this.actions.length) {
          list.innerHTML = '<div class="editor-empty">Load a story to edit actions.<br>Drag rows to reorder, click text to edit.</div>';
          return;
        }
        list.innerHTML = '';
        this.actions.forEach((a, i) => {
          const row = document.createElement('div');
          row.className = 'ed-action-row';
          row.draggable = true;
          row.dataset.idx = i;

          const typeClass = 'ed-type-' + (a.type || 'wait');
          const who = a.who || a.character || '';
          let detail = '';
          if (a.type === 'say') detail = `"${a.text || ''}"`;
          else if (a.type === 'move') detail = `${a.direction || ''} ${a.steps || ''}`;
          else if (a.type === 'emote') detail = a.emotion || '';
          else if (a.type === 'wait') detail = `${a.duration || 1}s`;
          else if (a.type === 'scene_change') detail = a.scene || '';

          row.innerHTML = `
            <span class="ed-idx">${i + 1}</span>
            <span class="ed-type-badge ${typeClass}">${a.type}</span>
            <div class="ed-content">
              ${who ? `<div class="ed-who">${who}</div>` : ''}
              ${a.type === 'say'
              ? `<input class="ed-txt-input" data-idx="${i}" data-field="text" value="${(a.text || '').replace(/"/g, '&quot;')}" placeholder="dialogue…">`
              : `<div class="ed-detail">${detail}</div>`}
            </div>
            <button class="ed-del" data-idx="${i}" title="Delete">✕</button>`;

          row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i); row.classList.add('dragging'); });
          row.addEventListener('dragend', () => row.classList.remove('dragging'));
          row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over'); });
          row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
          row.addEventListener('drop', e => {
            e.preventDefault(); row.classList.remove('drag-over');
            const from = parseInt(e.dataTransfer.getData('text/plain'));
            const to = i;
            if (from === to) return;
            const [moved] = this.actions.splice(from, 1);
            this.actions.splice(to, 0, moved);
            this.render();
          });

          list.appendChild(row);
        });

        list.querySelectorAll('.ed-del').forEach(btn => {
          btn.addEventListener('click', () => {
            this.actions.splice(parseInt(btn.dataset.idx), 1);
            this.render();
          });
        });

        list.querySelectorAll('.ed-txt-input').forEach(inp => {
          inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset.idx);
            this.actions[idx][inp.dataset.field] = inp.value;
          });
        });
      },

      toJSON() {
        if (!engine.story) return null;
        return Object.assign({}, engine.story, { actions: this.actions });
      }
    };

    document.getElementById('ed-apply').addEventListener('click', () => {
      const updated = AnimEditor.toJSON();
      if (!updated) { showToastGlobal('No story loaded', 'err'); return; }
      doLoad(updated);
      showToastGlobal('Animation updated ✓', 'ok');
    });

    document.getElementById('ed-clear').addEventListener('click', () => {
      if (!confirm('Clear all editor changes?')) return;
      if (engine.story) AnimEditor.populate(engine.story);
    });

    /* ── PHASE 3: PRICING MODAL ─────────────────────────── */
    document.getElementById('btn-upgrade').addEventListener('click', () => {
      document.getElementById('pricing-modal').classList.add('visible');
    });

    document.getElementById('pricing-close').addEventListener('click', () => {
      document.getElementById('pricing-modal').classList.remove('visible');
    });

    document.getElementById('pricing-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('pricing-modal'))
        document.getElementById('pricing-modal').classList.remove('visible');
    });

    document.querySelectorAll('.tier-btn[data-plan]').forEach(btn => {
      btn.addEventListener('click', () => {
        showToastGlobal('Billing coming soon — join the waitlist at parsia.app', 'ok');
        document.getElementById('pricing-modal').classList.remove('visible');
      });
    });

    /* ── PHASE 3: VIDEO EXPORT ──────────────────────────── */
    const ExportManager = {
      recorder: null,
      chunks: [],
      cancelled: false,

      open() { document.getElementById('export-modal').classList.add('visible'); },
      close() {
        document.getElementById('export-modal').classList.remove('visible');
        document.getElementById('export-opts-wrap').style.display = 'flex';
        document.getElementById('export-progress').classList.remove('active');
        this.cancelled = true;
        if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
      },

      async recordWebM() {
        if (!engine.story) { showToastGlobal('Load an animation first', 'err'); this.close(); return; }
        const canvas = document.getElementById('scene-canvas');
        if (!canvas.captureStream) { showToastGlobal('WebM export not supported in this browser', 'err'); this.close(); return; }

        document.getElementById('export-opts-wrap').style.display = 'none';
        const prog = document.getElementById('export-progress');
        prog.classList.add('active');
        const fill = document.getElementById('exp-fill');
        const label = document.getElementById('exp-label');

        this.chunks = []; this.cancelled = false;
        const stream = canvas.captureStream(30);
        this.recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
        this.recorder.onstop = () => {
          if (this.cancelled) return;
          const blob = new Blob(this.chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = (engine.story.scene || 'parsia') + '_animation.webm';
          a.click(); URL.revokeObjectURL(url);
          this.close();
          showToastGlobal('Video exported ✓', 'ok');
        };

        /* Rewind, record, stop when done */
        engine.fullReset();
        await new Promise(r => setTimeout(r, 100));
        this.recorder.start(100);
        engine.play();

        const totalActions = engine.story.actions.length;
        const pollInterval = setInterval(() => {
          if (this.cancelled) { clearInterval(pollInterval); return; }
          const pct = Math.round((engine.cursor / Math.max(1, totalActions)) * 100);
          fill.style.width = Math.min(pct, 95) + '%';
          label.textContent = `Recording… ${Math.min(pct, 95)}%`;
          if (engine.cursor >= totalActions && !engine.running) {
            clearInterval(pollInterval);
            fill.style.width = '100%';
            label.textContent = 'Finalizing…';
            setTimeout(() => { if (!this.cancelled) this.recorder.stop(); }, 400);
          }
        }, 250);
      },

      exportJSON() {
        if (!engine.story) { showToastGlobal('No animation loaded', 'err'); return; }
        const blob = new Blob([JSON.stringify(engine.story, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (engine.story.scene || 'parsia') + '_animation.json';
        a.click(); URL.revokeObjectURL(url);
        this.close();
        showToastGlobal('JSON exported ✓', 'ok');
      }
    };

    document.getElementById('btn-export').addEventListener('click', () => ExportManager.open());
    document.getElementById('export-close').addEventListener('click', () => ExportManager.close());
    document.getElementById('export-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('export-modal')) ExportManager.close();
    });
    document.getElementById('exp-cancel').addEventListener('click', () => ExportManager.close());
    document.getElementById('exp-webm').addEventListener('click', () => ExportManager.recordWebM());
    /* GIF export handler registered below after GIF lib check */
    document.getElementById('exp-json').addEventListener('click', () => ExportManager.exportJSON());

    // Compiler
    document.getElementById('compile-btn').addEventListener('click', () => {
      const src = document.getElementById('script-input').value;
      const btn = document.getElementById('compile-btn');
      btn.disabled = true;
      const result = compileStory(src);
      const out = document.getElementById('compile-output');
      out.innerHTML = result.log.map(({ cls, msg }) =>
        `<span class="${cls}">${msg.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`
      ).join('\n');
      if (result.ok) doLoad(result.output);
      btn.disabled = false;
    });

    /* ── PHASE 4: STORY TEMPLATES ───────────────────────── */
    const TEMPLATES = {
      hero: `In the ancient Forest of Whispers, the brave hero Marcus stood alone beneath the towering oak trees. Suddenly a dark shadow fell across the path — the villain Shade stepped out from behind a gnarled trunk. His eyes blazed red with malice. Marcus drew his sword and said: I will not let you pass. Shade laughed coldly and replied: You have no idea what power you face. Marcus stood his ground and said: Then let me show you what courage looks like. Shade lunged forward, but Marcus dodged swiftly and struck back. Shade stumbled, shocked. Marcus smiled triumphantly and said: The forest is safe today.`,

      romance: `Elena walked slowly through the moonlit Castle courtyard, lost in thought. Then she noticed a young scholar named Ren reading quietly by the fountain. He looked up, startled, and said: I did not expect anyone else to be awake this late. Elena smiled and replied: The stars keep me company when I cannot sleep. Ren stood up shyly and said: Perhaps we can watch them together? Elena laughed softly and said: I would like that very much. They sat together under the glittering sky, talking until dawn, discovering they shared the same dreams.`,

      mystery: `Detective Mira arrived at the shadowy City docks just after midnight. Her informant Scholar had sent a cryptic message. Scholar appeared from the fog and said nervously: They know you are investigating. Mira narrowed her eyes and replied: Who knows? Scholar leaned closer and whispered: The merchant guild. They have been smuggling something far worse than gold. Mira said grimly: Show me the evidence. Scholar pulled out a sealed document and said: This will change everything. Mira studied it, then looked up slowly and said: I know exactly who is behind this.`,

      comedy: `At the busy City marketplace, the bumbling merchant Gerald was trying to sell his peculiar wares. Elder Pompous approached with great dignity and said: What exactly is this contraption? Gerald waved his hands wildly and replied: It is a revolutionary hat-straightening device! Elder Pompous put it on and it promptly launched itself off his head. The crowd roared with laughter. Gerald jumped and said: Wait wait it just needs calibration! Elder Pompous crossed his arms and replied: Young man I have seen many things but nothing quite as useless as this. Gerald grinned and said: Exactly — that is why it is so valuable!`,

      scifi: `Commander Nova stood on the bridge of her Spaceship as the proximity alarm blared. Pilot Zek rushed in and said: Captain we are receiving a signal from sector nine. Nova studied the display and replied: That sector has been empty for two hundred years. Zek leaned in and whispered: Not anymore. On the screen a vast alien structure slowly rotated in the void. Nova straightened and said: Prepare a response signal. Zek hesitated and asked: What do we say? Nova smiled steadily and replied: Hello. We come in peace. The structure pulsed with a warm golden light.`,

      fable: `In the tranquil Forest clearing, the Elder Tortoise had lived for three hundred years. One day a young Traveler rushed past without stopping. The Elder called out gently: Young friend, where do you run so fast? The Traveler skidded to a halt and said: I am chasing my future! There is no time to stop. The Elder smiled wisely and replied: The one who races past every flower never reaches the garden. The Traveler frowned and asked: What does that mean? The Elder said: Sit. I will show you. They watched the sunset together in silence. Finally the Traveler whispered: I think I understand now.`,
    };

    document.querySelectorAll('.tpl-card').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.dataset.tpl;
        const text = TEMPLATES[key];
        if (!text) return;
        document.getElementById('sm-english').value = text;
        /* fire word count update */
        document.getElementById('sm-english').dispatchEvent(new Event('input'));
        /* switch to English tab */
        document.querySelectorAll('.sm-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sm-pane').forEach(p => p.classList.remove('active'));
        document.querySelector('.sm-tab[data-tab="english"]').classList.add('active');
        document.getElementById('sm-pane-english').classList.add('active');
      });
    });

    /* ── PHASE 4: KEYBOARD SHORTCUTS PANEL ──────────────── */
    const kbModal = document.getElementById('kb-modal');
    document.getElementById('kb-close').addEventListener('click', () => kbModal.classList.remove('visible'));
    kbModal.addEventListener('click', e => { if (e.target === kbModal) kbModal.classList.remove('visible'); });

    /* ── PHASE 4: EXTRA KEYBOARD BINDINGS ───────────────── */
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      /* ? → shortcuts panel */
      if (e.key === '?') { kbModal.classList.add('visible'); return; }
      /* 1 / 2 / 3 → inspector tabs */
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const tabs = ['stage', 'compile', 'editor'];
        const target = tabs[parseInt(e.key) - 1];
        if (!target) return;
        document.querySelectorAll('.ins-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ins-pane').forEach(p => p.classList.remove('active'));
        document.querySelector(`.ins-tab[data-tab="${target}"]`).classList.add('active');
        document.getElementById('ins-' + target).classList.add('active');
        return;
      }
      /* Ctrl+S → save */
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('btn-save').click();
        return;
      }
      /* Ctrl+O → open file */
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        document.getElementById('file-in').click();
        return;
      }
      /* Ctrl+Shift+E → export */
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        document.getElementById('btn-export').click();
        return;
      }
      /* Ctrl+Enter → story modal */
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('enter-btn')?.click();
        return;
      }
      /* Escape → close any open modal */
      if (e.key === 'Escape') {
        kbModal.classList.remove('visible');
        document.getElementById('export-modal').classList.remove('visible');
        document.getElementById('pricing-modal').classList.remove('visible');
        document.getElementById('discover-modal').classList.remove('visible');
      }
    });

    /* ── PHASE 4: ONBOARDING TOUR ───────────────────────── */
    const Tour = (function () {
      const STEPS = [
        {
          anchor: '#btn-demo',
          body: `Welcome to <strong>Parsia Studio</strong>! Click <strong>▶ Demo Story</strong> to instantly load a pre-built animation and see the engine in action.`,
          position: 'below-left',
        },
        {
          anchor: '#enter-btn',
          body: `Click the glowing button on the intro screen — or use <strong>Ctrl+Enter</strong> from anywhere — to open the Story Editor where you write your own narrative.`,
          position: 'below-left',
        },
        {
          anchor: '#btn-sound',
          body: `Toggle <strong>ambient audio</strong> to add atmospheric sound that matches your scene — forest birds, castle echoes, city hum.`,
          position: 'below-left',
        },
        {
          anchor: '.ins-tab[data-tab="editor"]',
          body: `The <strong>Editor tab</strong> lets you rearrange, edit, or delete individual animation actions — drag rows to reorder them, then hit Apply.`,
          position: 'below-left',
        },
        {
          anchor: '#btn-export',
          body: `When your animation is ready, hit <strong>⬇ Export</strong> to save it as a WebM video or animation JSON. Press <strong>?</strong> anytime for keyboard shortcuts.`,
          position: 'below-left',
        },
      ];

      let current = 0;
      const overlay = document.getElementById('tour-overlay');
      const tip = document.getElementById('tour-tip');
      const badge = document.getElementById('tour-step-badge');
      const body = document.getElementById('tour-body');
      const btnNext = document.getElementById('tour-next');
      const btnSkip = document.getElementById('tour-skip');

      function position(anchorSel) {
        const el = document.querySelector(anchorSel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        tip.style.top = (r.bottom + 12) + 'px';
        tip.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 296)) + 'px';
      }

      function show(idx) {
        if (idx >= STEPS.length) { end(); return; }
        current = idx;
        const s = STEPS[idx];
        badge.textContent = (idx + 1) + ' / ' + STEPS.length;
        body.innerHTML = s.body;
        btnNext.textContent = idx === STEPS.length - 1 ? 'Done ✓' : 'Next →';
        overlay.classList.add('active');
        tip.classList.add('active');
        position(s.anchor);
      }

      function end() {
        overlay.classList.remove('active');
        tip.classList.remove('active');
        localStorage.setItem('parsia_onboarded', '1');
      }

      btnNext.addEventListener('click', () => show(current + 1));
      btnSkip.addEventListener('click', end);

      return {
        start() { show(0); },
        started: false,
        maybeStart() {
          if (!localStorage.getItem('parsia_onboarded') && !this.started) {
            this.started = true;
            setTimeout(() => this.start(), 1800);
          }
        }
      };
    })();

    /* ── PHASE 4: DISCOVER (PUBLIC GALLERY) ─────────────── */
    document.getElementById('btn-discover').addEventListener('click', () => {
      document.getElementById('discover-modal').classList.add('visible');
      loadDiscoverStories();
    });

    document.getElementById('discover-close').addEventListener('click', () => {
      document.getElementById('discover-modal').classList.remove('visible');
    });

    document.getElementById('discover-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('discover-modal'))
        document.getElementById('discover-modal').classList.remove('visible');
    });

    let _discoverData = [];

    async function loadDiscoverStories() {
      const grid = document.getElementById('discover-grid');
      const countEl = document.getElementById('discover-count');
      grid.innerHTML = '<div class="gallery-empty"><div class="gallery-empty-icon">⏳</div>Loading community stories…</div>';

      /* Try Supabase public query — needs is_public column (graceful fallback) */
      try {
        const sb = window._parsiaSupabase;
        if (!sb) throw new Error('no client');
        const { data, error } = await sb
          .from('stories')
          .select('id, title, scene, character_count, action_count, animation, created_at')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(48);

        if (error) throw error;
        _discoverData = data || [];
        renderDiscover(_discoverData);
        countEl.textContent = _discoverData.length + ' public ' + (_discoverData.length === 1 ? 'story' : 'stories');
      } catch {
        /* Fallback: show demo cards so the modal is never empty */
        _discoverData = [];
        grid.innerHTML = '<div class="gallery-empty"><div class="gallery-empty-icon">🌐</div>Public gallery requires the <code>is_public</code> column in your Supabase <em>stories</em> table.<br><small>Run: ALTER TABLE stories ADD COLUMN is_public BOOLEAN DEFAULT false;</small></div>';
        countEl.textContent = '—';
      }
    }

    function renderDiscover(items) {
      const grid = document.getElementById('discover-grid');
      if (!items.length) {
        grid.innerHTML = '<div class="gallery-empty"><div class="gallery-empty-icon">🎬</div>No public stories yet. Save one and check "Make public"!</div>';
        return;
      }
      grid.className = 'gallery-grid';
      grid.innerHTML = '';
      items.forEach(story => {
        const card = document.createElement('div');
        card.className = 'disc-card';
        const initials = (story.title || 'U').slice(0, 2).toUpperCase();
        const date = new Date(story.created_at).toLocaleDateString();
        card.innerHTML = `
          <div class="disc-author">
            <span class="disc-author-dot">${initials[0]}</span>
            <span>${story.scene || 'Unknown Scene'}</span>
            <span style="margin-left:auto">${date}</span>
          </div>
          <div class="sc-scene">${(story.title || story.scene || 'Untitled').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
          <div class="sc-meta">
            <span class="sc-badge">⚡ ${story.action_count ?? 0} actions</span>
            <span class="sc-badge">👥 ${story.character_count ?? 0} chars</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button class="disc-watch" style="flex:1">▶ WATCH</button>
            <button class="disc-remix" title="Remix — loads into editor">✦ REMIX</button>
          </div>`;
        card.querySelector('.disc-watch').addEventListener('click', () => {
          document.getElementById('discover-modal').classList.remove('visible');
          doLoad(story.animation);
          showToastGlobal('Loaded: ' + (story.scene || 'Story'), 'ok');
        });
        card.querySelector('.disc-remix').addEventListener('click', () => {
          document.getElementById('discover-modal').classList.remove('visible');
          doLoad(story.animation);
          /* Switch to editor tab */
          document.querySelectorAll('.ins-tab').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.ins-pane').forEach(p => p.classList.remove('active'));
          document.querySelector('.ins-tab[data-tab="editor"]').classList.add('active');
          document.getElementById('ins-editor').classList.add('active');
          /* Prefill DSL textarea if source is stored */
          if (story.source) document.getElementById('script-input').value = story.source;
          showToastGlobal('Remixed! Edit actions in the Editor tab ✓', 'ok');
        });
        grid.appendChild(card);
      });
    }

    /* Live search filter for discover */
    document.getElementById('disc-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      const filtered = _discoverData.filter(s =>
        (s.scene || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q)
      );
      renderDiscover(filtered);
    });

    document.getElementById('disc-sort').addEventListener('change', e => {
      const sorted = [..._discoverData].sort((a, b) =>
        e.target.value === 'oldest'
          ? new Date(a.created_at) - new Date(b.created_at)
          : new Date(b.created_at) - new Date(a.created_at)
      );
      renderDiscover(sorted);
    });

    /* ── PHASE 4: PWA SERVICE WORKER ────────────────────── */
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => { });
      });
    }

    /* ── PHASE 4: PWA INSTALL PROMPT ────────────────────── */
    let _deferredInstall = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredInstall = e;
      /* Show install hint in header after a delay */
      setTimeout(() => {
        if (!_deferredInstall) return;
        const btn = document.createElement('button');
        btn.className = 'btn-sm';
        btn.id = 'btn-install';
        btn.textContent = '⊕ Install App';
        btn.addEventListener('click', async () => {
          _deferredInstall.prompt();
          const { outcome } = await _deferredInstall.userChoice;
          if (outcome === 'accepted') { btn.remove(); _deferredInstall = null; }
        });
        document.querySelector('.hdr-right').insertBefore(btn, document.getElementById('btn-demo').nextSibling);
      }, 4000);
    });

    /* ── EMBED MODE ─────────────────────────────────────── */
    (function () {
      const params = new URLSearchParams(location.search);
      if (params.get('embed') === '1') {
        document.body.classList.add('embed');
        /* Auto-load from ?src= URL or hash */
        const src = params.get('src');
        if (src) {
          fetch(src).then(r => r.json()).then(data => { if (data && data.actions) { doLoad(data); engine.play(); } }).catch(() => { });
        } else {
          const hash = ShareLink.checkHash();
          if (hash && hash.actions) { doLoad(hash); engine.play(); }
        }
      }
    })();

    /* ── FULLSCREEN ─────────────────────────────────────── */
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      const vp = document.getElementById('vp');
      if (!document.fullscreenElement) {
        vp.requestFullscreen().catch(() => { });
        document.getElementById('btn-fullscreen').textContent = '⛶';
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const btn = document.getElementById('btn-fullscreen');
      btn.textContent = document.fullscreenElement ? '✕' : '⛶';
      btn.title = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    });

    /* ── SCREENSHOT ─────────────────────────────────────── */
    document.getElementById('btn-screenshot').addEventListener('click', () => {
      const canvas = document.getElementById('scene-canvas');
      const ai = document.getElementById('ai-bg-layer');

      /* Compose: ai-bg-layer + canvas onto an offscreen canvas */
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const ctx = offscreen.getContext('2d');

      /* Draw AI background if available */
      const bgImg = ai.style.backgroundImage;
      const urlMatch = bgImg && bgImg.match(/url\("?([^")]+)"?\)/);
      const drawAndSave = () => {
        ctx.drawImage(canvas, 0, 0);
        const a = document.createElement('a');
        a.download = (engine.story?.scene || 'parsia') + '_frame.png';
        a.href = offscreen.toDataURL('image/png');
        a.click();
        showToastGlobal('Frame saved as PNG ✓', 'ok');
      };

      if (urlMatch) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height); drawAndSave(); };
        img.onerror = drawAndSave;
        img.src = urlMatch[1];
      } else {
        drawAndSave();
      }
    });

    /* ── LOOP TOGGLE ────────────────────────────────────── */
    let _loopMode = false;
    document.getElementById('btn-loop').addEventListener('click', () => {
      _loopMode = !_loopMode;
      document.getElementById('btn-loop').classList.toggle('active', _loopMode);
      showToastGlobal(_loopMode ? 'Loop mode ON' : 'Loop mode OFF', 'ok');
    });

    /* Hook into engine end-of-story to replay when loop is on */
    const _origEngineStep = engine.step.bind(engine);
    const _checkLoop = () => {
      if (_loopMode && engine.story && engine.cursor >= engine.story.actions.length - 1) {
        setTimeout(() => { if (_loopMode) { engine.fullReset(); engine.play(); } }, 600);
      }
    };

    /* Patch engine.step to check loop */
    const _origStep = engine.step;
    engine.step = function (...args) {
      const result = _origStep.apply(this, args);
      _checkLoop();
      return result;
    };

    /* ── GIF EXPORT (replaces the stub) ─────────────────── */
    document.getElementById('exp-gif').addEventListener('click', async () => {
      if (!engine.story) { showToastGlobal('Load an animation first', 'err'); return; }
      if (typeof GIF === 'undefined') { showToastGlobal('GIF library not loaded — use WebM instead', 'err'); return; }

      const canvas = document.getElementById('scene-canvas');
      document.getElementById('export-opts-wrap').style.display = 'none';
      const prog = document.getElementById('export-progress');
      prog.classList.add('active');
      const fill = document.getElementById('exp-fill');
      const label = document.getElementById('exp-label');
      label.textContent = 'Capturing frames…';

      const gif = new GIF({
        workers: 2,
        quality: 8,
        width: canvas.width,
        height: canvas.height,
        workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js',
      });

      engine.fullReset();
      await new Promise(r => setTimeout(r, 80));

      const totalActions = engine.story.actions.length;
      const frameInterval = 100; /* ms between captured frames */
      let frameCount = 0;
      const maxFrames = 200;

      engine.play();

      await new Promise(resolve => {
        const capturer = setInterval(() => {
          gif.addFrame(canvas, { copy: true, delay: frameInterval });
          frameCount++;
          const pct = Math.round((engine.cursor / Math.max(1, totalActions)) * 90);
          fill.style.width = pct + '%';
          label.textContent = `Capturing frames… ${frameCount}`;
          if (frameCount >= maxFrames || (engine.cursor >= totalActions && !engine.running)) {
            clearInterval(capturer);
            resolve();
          }
        }, frameInterval);
      });

      fill.style.width = '92%';
      label.textContent = 'Encoding GIF…';

      gif.on('progress', p => { fill.style.width = (92 + p * 8) + '%'; });
      gif.on('finished', blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (engine.story.scene || 'parsia') + '_animation.gif';
        a.click(); URL.revokeObjectURL(url);
        ExportManager.close();
        showToastGlobal('GIF exported ✓ (' + Math.round(blob.size / 1024) + ' KB)', 'ok');
      });
      gif.render();
    }, { once: false });

    /* ── CHARACTER CUSTOMIZER ───────────────────────────── */
    const ARCHETYPES = ['auto', 'hero', 'villain', 'wizard', 'knight', 'scholar', 'elder', 'merchant', 'child'];
    const _archetypeOverrides = {};

    function buildCharCards(characters) {
      const list = document.getElementById('char-list');
      list.innerHTML = '';
      if (!characters || !characters.length) return;
      characters.forEach(name => {
        const card = document.createElement('div');
        card.className = 'char-card';
        const color = charStyle(name, 0)?.color || '#00c9b1';
        card.innerHTML = `
          <div class="char-card-dot" style="background:${color}"></div>
          <span class="char-card-name">${name}</span>
          <span class="char-card-status off" id="cstatus-${name}">OFF</span>
          <select class="char-archetype-sel" data-char="${name}" title="Override archetype">
            ${ARCHETYPES.map(a => `<option value="${a}"${(_archetypeOverrides[name] || 'auto') === a ? ' selected' : ''}>${a}</option>`).join('')}
          </select>`;
        list.appendChild(card);
        card.querySelector('.char-archetype-sel').addEventListener('change', e => {
          const val = e.target.value;
          if (val === 'auto') delete _archetypeOverrides[name];
          else _archetypeOverrides[name] = val;
          showToastGlobal(`${name} → ${val === 'auto' ? 'auto-detected' : val} archetype`, 'ok');
        });
      });
    }

    /* Patch doLoad to also build char cards */
    const _origDoLoadForCards = doLoad;
    doLoad = function (json) {
      _origDoLoadForCards(json);
      if (json?.characters) setTimeout(() => buildCharCards(json.characters), 50);
    };

    /* ── pub-toggle JS visibility (fallback for :has()) ─── */
    function syncPubToggle(isLoggedIn) {
      const tog = document.getElementById('save-public-chk');
      if (!tog) return;
      tog.closest('.pub-toggle').style.display = isLoggedIn ? 'flex' : 'none';
    }

    // Auto-load animation.json if present
    fetch('animation.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.actions) doLoad(data); })
      .catch(() => { });

    /* ──────────────────────────────────────────
       STORY MODAL + DSL TERMINAL CONTROLLER
    ────────────────────────────────────────── */
    (function () {
      const modal = document.getElementById('story-modal');
      const terminal = document.getElementById('dsl-terminal');
      const log = document.getElementById('dt-log');
      const prog = document.getElementById('dt-prog');
      const status = document.getElementById('dt-status');
      const launchBtn = document.getElementById('dt-launch');

      /* ── Tab switching ── */
      document.querySelectorAll('.sm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.sm-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.sm-pane').forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById('sm-pane-' + tab.dataset.tab).classList.add('active');
        });
      });

      /* ── Word counter ── */
      const englishTA = document.getElementById('sm-english');
      const wcEl = document.getElementById('sm-word-count');
      const WORD_LIMIT = 2000;
      function updateWordCount() {
        const words = englishTA.value.trim() === '' ? 0 : englishTA.value.trim().split(/\s+/).length;
        wcEl.textContent = words + ' / ' + WORD_LIMIT + ' words';
        wcEl.className = 'sm-wc' + (words > WORD_LIMIT ? ' over' : words > WORD_LIMIT * 0.85 ? ' warn' : '');
      }
      englishTA.addEventListener('input', updateWordCount);

      /* ── Genre selector ── */
      let selectedGenre = '';
      document.querySelectorAll('.sm-genre').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.sm-genre').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedGenre = btn.dataset.genre;
        });
      });

      /* ── Skip buttons ── */
      document.getElementById('sm-skip').addEventListener('click', () => launchApp());
      document.getElementById('sm-skip-eng').addEventListener('click', () => launchApp());

      /* ── Compile & Launch (DSL mode) ── */
      document.getElementById('sm-compile').addEventListener('click', () => {
        const src = document.getElementById('sm-textarea').value.trim();
        if (!src) return;
        modal.classList.remove('visible');
        setTimeout(() => runTerminal(src), 400);
      });

      /* ── Generate Animation (English mode) ── */
      document.getElementById('sm-generate').addEventListener('click', () => {
        const text = englishTA.value.trim();
        if (!text) return;
        const words = text.split(/\s+/).length;
        if (words > WORD_LIMIT) { alert(`Story exceeds ${WORD_LIMIT} word limit. Please shorten it.`); return; }
        const apiUrl = (document.getElementById('sm-api-url').value.trim() || 'http://localhost:8000').replace(/\/$/, '');
        const storyWithGenre = selectedGenre ? `[Tone: ${selectedGenre}]\n\n${text}` : text;
        modal.classList.remove('visible');
        setTimeout(() => runTranslateTerminal(storyWithGenre, apiUrl), 400);
      });

      /* ── Launch scene button (shown at terminal end) ── */
      launchBtn.addEventListener('click', () => launchApp());

      /* ─────────────────────────────────────────────────
         runTerminal — animates all 7 compiler phases
         inside the holographic terminal, then reveals
         the LAUNCH button when compilation succeeds.
      ───────────────────────────────────────────────── */
      function runTerminal(src) {
        log.innerHTML = '';
        prog.style.width = '0%';
        status.className = 'dt-status running';
        status.textContent = '● COMPILING…';
        launchBtn.textContent = 'LAUNCH SCENE ▶';
        launchBtn.classList.remove('show');
        terminal.classList.add('visible');

        /* We run the real JS compiler but feed its phases into the
           animated terminal one by one with deliberate delays.       */
        const phaseDelay = 320;   // ms between phases appearing
        const lineDelay = 60;    // ms per character in typewriter
        const totalPhases = 7;
        let compiledResult = null;

        /* ── helpers ─────────────────────────────────────────────── */
        function addRow(html, cssClass = '') {
          const row = document.createElement('span');
          row.className = 'dt-phase' + (cssClass ? ' ' + cssClass : '');
          row.innerHTML = html;
          log.appendChild(row);
          requestAnimationFrame(() => row.classList.add('show'));
          log.scrollTop = log.scrollHeight;
          return row;
        }

        function addDivider() {
          const d = document.createElement('span');
          d.className = 'dt-divider';
          log.appendChild(d);
          requestAnimationFrame(() => d.classList.add('show'));
        }

        /* Typewriter a single span's textContent */
        function typewrite(span, text, charMs = lineDelay) {
          return new Promise(resolve => {
            let i = 0;
            const cursor = document.createElement('span');
            cursor.className = 'dt-cursor';
            span.appendChild(cursor);
            const iv = setInterval(() => {
              span.textContent = text.slice(0, ++i);
              span.appendChild(cursor);
              log.scrollTop = log.scrollHeight;
              if (i >= text.length) {
                clearInterval(iv);
                cursor.remove();
                resolve();
              }
            }, charMs);
          });
        }

        /* Set progress bar to a percentage */
        function setProgress(pct) {
          prog.style.width = pct + '%';
        }

        /* ── Phase sequence ─────────────────────────────────────── */
        async function animate() {
          /* Header */
          addRow(
            '<span class="dt-phase-hi">═══ Parsia Compiler v1.0 ═══</span>'
          );
          addRow(
            '<span class="dt-phase-dim">// 7-phase pipeline executing…</span>'
          );
          addDivider();
          await sleep(phaseDelay);

          /* Run the real compiler and capture data at each phase */
          let tokens, ast, sem, ir, irOpt, output;
          let errorMsg = null;

          try {
            /* Phase 1 — Lexing */
            const ph1 = addRow('<span class="dt-phase-head">▶ Phase 1 — Lexical Analysis</span>');
            await sleep(phaseDelay);
            tokens = new StoryLexer(src).tokenize();
            setProgress(14);
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `   ✓ ${tokens.length} tokens produced`,
              lineDelay
            );
            await sleep(phaseDelay);

            /* Phase 2/3 — Parsing */
            addRow('<span class="dt-phase-head">▶ Phase 2/3 — Parsing (AST construction)</span>');
            await sleep(phaseDelay);
            ast = new StoryParser(tokens).parse();
            setProgress(28);
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `   ✓ ${ast.body.length} top-level AST nodes`,
              lineDelay
            );
            await sleep(phaseDelay);

            /* Phase 4 — Semantic Analysis */
            addRow('<span class="dt-phase-head">▶ Phase 4 — Semantic Analysis</span>');
            await sleep(phaseDelay);
            sem = new StorySemantic();
            sem.analyse(ast);
            setProgress(42);
            sem.warns.forEach(w =>
              addRow(`   <span class="dt-phase-warn">⚠ ${escHtml(w)}</span>`)
            );
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `   ✓ ${Object.keys(sem.chars).length} character(s), ${sem.tasks.size} task(s), ${Object.keys(sem.vars).length} variable(s)`,
              lineDelay
            );
            await sleep(phaseDelay);

            /* Phase 5 — IR Generation */
            addRow('<span class="dt-phase-head">▶ Phase 5 — IR Generation (Three-Address Code)</span>');
            await sleep(phaseDelay);
            ir = new StoryIRGen().generate(ast);
            setProgress(57);
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `   ✓ ${ir.length} IR instructions generated`,
              lineDelay
            );
            await sleep(phaseDelay);

            /* Phase 6 — Optimization */
            addRow('<span class="dt-phase-head">▶ Phase 6 — Optimization (constant folding + DSE)</span>');
            await sleep(phaseDelay);
            irOpt = new StoryOptimizer().run(ir);
            setProgress(71);
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `   ✓ ${ir.length} → ${irOpt.length} instructions after optimization`,
              lineDelay
            );
            await sleep(phaseDelay);

            /* Phase 7 — Code Generation */
            addRow('<span class="dt-phase-head">▶ Phase 7 — Code Generation & Execution</span>');
            await sleep(phaseDelay);
            output = new StoryCodeGen().execute(irOpt);
            compiledResult = output;
            setProgress(100);
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `   ✓ ${output.actions.length} animation actions emitted`,
              lineDelay
            );
            await sleep(phaseDelay);

            /* Success */
            addDivider();
            await sleep(120);
            await typewrite(
              addRow('', 'dt-phase-ok'),
              `✅  Compilation successful!  Scene: ${output.scene}  ·  ${output.characters.length} character(s)`,
              lineDelay
            );

            status.className = 'dt-status done';
            status.textContent = '● READY';
            launchBtn.classList.add('show');

          } catch (err) {
            errorMsg = err.message;
            setProgress(100);
            addDivider();
            addRow(`<span class="dt-phase-err">❌  ${escHtml(errorMsg)}</span>`);
            status.className = 'dt-status error';
            status.textContent = '● ERROR';
            /* Still show Launch (will go to app without loading) */
            launchBtn.textContent = 'CLOSE ✕';
            launchBtn.classList.add('show');
          }

          /* Notify auth module so Save button can activate */
          if (compiledResult && typeof window._parsiaOnCompiled === 'function') {
            window._parsiaOnCompiled(src, compiledResult);
          }

          /* Override launch to pre-load the result if compilation succeeded */
          launchBtn.onclick = () => {
            if (compiledResult) doLoad(compiledResult);
            launchApp();
          };
        }

        animate();
      }

      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

      /* ─────────────────────────────────────────────────
         runTranslateTerminal — calls backend /translate-and-compile
         Animates the pipeline in the holographic terminal,
         showing NLP → DSL → 7-phase compilation phases.
      ───────────────────────────────────────────────── */
      function runTranslateTerminal(englishText, apiUrl) {
        log.innerHTML = '';
        prog.style.width = '0%';
        status.className = 'dt-status running';
        status.textContent = '● TRANSLATING…';
        launchBtn.classList.remove('show');
        launchBtn.textContent = 'LAUNCH SCENE ▶';
        terminal.classList.add('visible');

        const phaseDelay = 300;
        const lineDelay = 50;
        let compiledResult = null;

        function addRow(html, cssClass) {
          const row = document.createElement('span');
          row.className = 'dt-phase' + (cssClass ? ' ' + cssClass : '');
          row.innerHTML = html;
          log.appendChild(row);
          requestAnimationFrame(() => row.classList.add('show'));
          log.scrollTop = log.scrollHeight;
          return row;
        }
        function addDivider() {
          const d = document.createElement('span');
          d.className = 'dt-divider';
          log.appendChild(d);
          requestAnimationFrame(() => d.classList.add('show'));
        }
        function typewrite(span, text, charMs) {
          charMs = charMs || lineDelay;
          return new Promise(resolve => {
            let i = 0;
            const cursor = document.createElement('span');
            cursor.className = 'dt-cursor';
            span.appendChild(cursor);
            const iv = setInterval(() => {
              span.textContent = text.slice(0, ++i);
              span.appendChild(cursor);
              log.scrollTop = log.scrollHeight;
              if (i >= text.length) { clearInterval(iv); cursor.remove(); resolve(); }
            }, charMs);
          });
        }
        function setProgress(pct) { prog.style.width = pct + '%'; }

        async function animate() {
          addRow('<span class="dt-phase-hi">═══ Parsia AI Pipeline ═══</span>');
          addRow('<span class="dt-phase-dim">// English → DSL → 7-phase compiler</span>');
          addDivider();
          await sleep(phaseDelay);

          /* Stage 1: NLP + AI Translation (API call) */
          addRow('<span class="dt-phase-head">▶ Stage 1 — NLP Translation (AI)</span>');
          await sleep(phaseDelay);
          addRow('<span class="dt-phase-dim">   → Sending to backend: ' + escHtml(apiUrl) + '/translate-and-compile</span>');
          setProgress(15);
          await sleep(phaseDelay);

          let parsiaSource = null;
          let output = null;

          try {
            const resp = await fetch(apiUrl + '/translate-and-compile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ story: englishText }),
            });

            if (!resp.ok) {
              const err = await resp.json().catch(() => ({ detail: resp.statusText }));
              const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
              throw new Error('API error ' + resp.status + ': ' + msg);
            }

            const data = await resp.json();
            parsiaSource = data.source;
            output = data.animation;

          } catch (fetchErr) {
            setProgress(100);
            addDivider();
            addRow(`<span class="dt-phase-err">❌  ${escHtml(fetchErr.message)}</span>`);
            addRow('<span class="dt-phase-dim">   Tip: make sure the backend is running — cd api &amp;&amp; uvicorn main:app --reload</span>');
            status.className = 'dt-status error';
            status.textContent = '● ERROR';
            launchBtn.textContent = 'CLOSE ✕';
            launchBtn.classList.add('show');
            launchBtn.onclick = () => launchApp();
            return;
          }

          setProgress(35);
          await typewrite(addRow('', 'dt-phase-ok'),
            '   ✓ AI translation complete — ' + parsiaSource.split('\n').length + ' DSL lines generated', lineDelay);
          await sleep(phaseDelay);
          addDivider();

          /* Stage 2: Show generated DSL snippet */
          addRow('<span class="dt-phase-head">▶ Stage 2 — Generated Parsia DSL</span>');
          await sleep(phaseDelay);
          const lines = parsiaSource.split('\n').slice(0, 6);
          for (const line of lines) {
            await typewrite(addRow('<span class="dt-phase-dim">   </span>', ''),
              '   ' + (line || ''), 18);
          }
          if (parsiaSource.split('\n').length > 6)
            addRow('<span class="dt-phase-dim">   … ' + (parsiaSource.split('\n').length - 6) + ' more lines</span>');
          setProgress(50);
          await sleep(phaseDelay);
          addDivider();

          /* Stage 3: Compiler stats from animation output */
          addRow('<span class="dt-phase-head">▶ Stage 3 — 7-Phase Compiler Pipeline</span>');
          await sleep(phaseDelay);
          const phases = [
            'Phase 1 — Lexical Analysis',
            'Phase 2/3 — Parsing (AST)',
            'Phase 4 — Semantic Analysis',
            'Phase 5 — IR Generation',
            'Phase 6 — Optimization',
            'Phase 7 — Code Generation',
          ];
          const progStep = 8;
          for (let i = 0; i < phases.length; i++) {
            addRow(`<span class="dt-phase-head">   ▸ ${phases[i]}</span>`);
            await sleep(phaseDelay * 0.7);
            await typewrite(addRow('', 'dt-phase-ok'), '      ✓ done', lineDelay);
            setProgress(50 + (i + 1) * progStep);
            await sleep(80);
          }

          compiledResult = output;
          setProgress(100);
          addDivider();
          await sleep(100);
          await typewrite(addRow('', 'dt-phase-ok'),
            `✅  Animation ready!  Scene: ${output.scene}  ·  ${output.characters.length} character(s)  ·  ${output.actions.length} actions`,
            lineDelay);

          status.className = 'dt-status done';
          status.textContent = '● READY';
          launchBtn.classList.add('show');

          if (compiledResult && typeof window._parsiaOnCompiled === 'function') {
            window._parsiaOnCompiled(parsiaSource, compiledResult);
          }

          launchBtn.onclick = () => {
            if (compiledResult) doLoad(compiledResult);
            launchApp();
          };
        }

        animate();
      }

    })();

    /* ══════════════════════════════════════════════════════
       AUTH MODULE — Backend-connected with bcrypt + JWT + OTP
       ──────────────────────────────────────────────────────
       Users stored in SQLite (parsia_users.db) via FastAPI backend
       Passwords hashed with SHA-256 + bcrypt (cost 12)
       OTP sent to registration email for verification
    ══════════════════════════════════════════════════════ */
    (function () {
      const AUTH_API = (document.getElementById('sm-api-url')?.value || 'http://localhost:8000').trim();

      /* ── state ───────────────────────────────────────────── */
      let currentUser = null;
      let authToken = localStorage.getItem('parsia_token') || null;
      let lastCompiled = null;

      /* ── DOM refs ────────────────────────────────────────── */
      const btnSignIn = document.getElementById('btn-signin');
      const btnSave = document.getElementById('btn-save');
      const btnGallery = document.getElementById('btn-gallery');
      const userChip = document.getElementById('user-chip');
      const userAvatar = document.getElementById('user-avatar');
      const userName = document.getElementById('user-name');
      const userDrop = document.getElementById('user-dropdown');
      const authModal = document.getElementById('auth-modal');
      const galleryModal = document.getElementById('gallery-modal');
      const galleryGrid = document.getElementById('gallery-grid');
      const galleryCount = document.getElementById('gallery-count');
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toast-msg');
      const toastIcon = document.getElementById('toast-icon');

      /* ── toast helper ─────────────────────────────────────── */
      let toastTimer = null;
      function showToast(msg, type = 'ok') {
        toastMsg.textContent = msg;
        toastIcon.textContent = type === 'ok' ? '✓' : '✕';
        toast.className = 'show ' + type;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = ''; }, 3200);
      }

      function setMsg(el, msg, type) {
        el.textContent = msg;
        el.className = 'auth-msg ' + type;
      }

      /* ── API helpers ─────────────────────────────────────── */
      async function authFetch(endpoint, body) {
        const res = await fetch(AUTH_API + '/auth' + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Request failed');
        return data;
      }

      /* ── SHA-256 client-side pre-hash (defense in depth) ── */
      async function sha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      /* ── Apply user state ────────────────────────────────── */
      function applyUser(user) {
        currentUser = user;
        window._parsiaUser = user; /* Bridge for requireLogin() on landing page */
        if (user) {
          const initials = (user.email || 'U').slice(0, 2).toUpperCase();
          userAvatar.textContent = initials;
          userName.textContent = user.name || user.email.split('@')[0];
          userChip.style.display = 'flex';
          btnSignIn.style.display = 'none';
          btnGallery.style.display = 'flex';
          if (lastCompiled) btnSave.style.display = 'flex';

          const adminBtn = document.getElementById('ud-admin');
          if (adminBtn) {
            adminBtn.style.display = user.role === 'admin' ? 'flex' : 'none';
          }
        } else {
          userChip.style.display = 'none';
          btnSignIn.style.display = 'flex';
          btnGallery.style.display = 'none';
          btnSave.style.display = 'none';
          const adminBtn = document.getElementById('ud-admin');
          if (adminBtn) adminBtn.style.display = 'none';
        }
      }

      /* ── Restore session from token ──────────────────────── */
      async function restoreSession() {
        if (!authToken) return;
        try {
          const res = await fetch(AUTH_API + '/auth/me', {
            headers: { 'Authorization': 'Bearer ' + authToken }
          });
          if (res.ok) {
            const user = await res.json();
            applyUser(user);
          } else {
            localStorage.removeItem('parsia_token');
            authToken = null;
          }
        } catch (e) {
          console.warn('[Parsia Auth] Session restore failed:', e.message);
        }
      }
      restoreSession();

      /* ── Auth pane switching ─────────────────────────────── */
      function showPane(paneId) {
        document.querySelectorAll('#auth-modal .auth-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('#auth-modal .auth-tab').forEach(t => t.classList.remove('active'));
        const pane = document.getElementById('atab-' + paneId);
        if (pane) pane.classList.add('active');
        const tab = document.querySelector(`.auth-tab[data-atab="${paneId}"]`);
        if (tab) tab.classList.add('active');
        /* Hide tabs for OTP/forgot/reset panes */
        const tabs = document.getElementById('auth-tabs');
        if (['otp', 'forgot', 'reset'].includes(paneId)) {
          tabs.style.display = 'none';
        } else {
          tabs.style.display = 'flex';
        }
      }

      /* ── Tab click handlers ─────────────────────────────── */
      document.querySelectorAll('#auth-tabs .auth-tab').forEach(tab => {
        tab.addEventListener('click', () => showPane(tab.dataset.atab));
      });

      /* Navigation links */
      document.getElementById('auth-goto-signup')?.addEventListener('click', () => showPane('signup'));
      document.getElementById('auth-goto-login')?.addEventListener('click', () => showPane('login'));
      document.getElementById('auth-goto-login-2')?.addEventListener('click', () => showPane('login'));
      document.getElementById('auth-goto-login-3')?.addEventListener('click', () => showPane('login'));
      document.getElementById('auth-forgot-btn')?.addEventListener('click', () => showPane('forgot'));

      /* ── Open / close auth modal ────────────────────────── */
      btnSignIn.addEventListener('click', () => {
        showPane('login');
        authModal.classList.add('visible');
      });
      document.getElementById('auth-close').addEventListener('click', () => authModal.classList.remove('visible'));
      authModal.addEventListener('click', e => { if (e.target === authModal) authModal.classList.remove('visible'); });

      /* ── Password visibility toggle ─────────────────────── */
      document.querySelectorAll('.auth-pw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = document.getElementById(btn.dataset.target);
          if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
          } else {
            input.type = 'password';
            btn.textContent = '👁';
          }
        });
      });

      /* ── Password strength meter ────────────────────────── */
      function checkStrength(pw) {
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
        return score;
      }

      const signupPassEl = document.getElementById('signup-pass');
      if (signupPassEl) {
        signupPassEl.addEventListener('input', () => {
          const score = checkStrength(signupPassEl.value);
          const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
          const classes = ['', 'weak', 'fair', 'good', 'strong'];
          for (let i = 1; i <= 4; i++) {
            const bar = document.getElementById('str-bar-' + i);
            bar.className = 'auth-strength-bar' + (i <= score ? ' ' + classes[score] : '');
          }
          document.getElementById('signup-strength-text').textContent = signupPassEl.value ? labels[score] : '';
        });
      }

      /* ── OTP digit boxes auto-advance ───────────────────── */
      function setupOtpBoxes(selector, dataAttr) {
        const boxes = document.querySelectorAll(selector);
        boxes.forEach((box, idx) => {
          box.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = val.slice(0, 1);
            if (val && idx < boxes.length - 1) boxes[idx + 1].focus();
            e.target.classList.toggle('filled', !!val);
          });
          box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
              boxes[idx - 1].focus();
              boxes[idx - 1].value = '';
              boxes[idx - 1].classList.remove('filled');
            }
          });
          box.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '');
            for (let i = 0; i < Math.min(paste.length, boxes.length); i++) {
              boxes[i].value = paste[i];
              boxes[i].classList.add('filled');
            }
            if (paste.length > 0) boxes[Math.min(paste.length, boxes.length) - 1].focus();
          });
        });
        return () => boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
      }

      const clearOtp = setupOtpBoxes('.auth-otp-digit[data-otp]', 'data-otp');
      const clearResetOtp = setupOtpBoxes('.auth-otp-digit[data-rotp]', 'data-rotp');

      function getOtpValue(selector) {
        return Array.from(document.querySelectorAll(selector)).map(b => b.value).join('');
      }

      /* ── OTP resend timer ───────────────────────────────── */
      let otpTimerInterval = null;
      function startOtpTimer() {
        let sec = 60;
        const btn = document.getElementById('otp-resend');
        btn.disabled = true;
        btn.textContent = `Resend in ${sec}s`;
        clearInterval(otpTimerInterval);
        otpTimerInterval = setInterval(() => {
          sec--;
          btn.textContent = `Resend in ${sec}s`;
          if (sec <= 0) {
            clearInterval(otpTimerInterval);
            btn.disabled = false;
            btn.textContent = 'Resend Code';
          }
        }, 1000);
      }

      let pendingOtpEmail = '';

      /* ═══ LOGIN ═══════════════════════════════════════════ */
      document.getElementById('login-submit').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-pass').value;
        const msgEl = document.getElementById('login-msg');
        if (!email || !pass) { setMsg(msgEl, 'Email and password required.', 'err'); return; }

        const btn = document.getElementById('login-submit');
        btn.disabled = true;
        btn.classList.add('loading');
        msgEl.className = 'auth-msg';

        try {
          const data = await authFetch('/login', { email, password: pass });

          if (data.requires_otp) {
            /* Email not verified yet — show OTP pane */
            pendingOtpEmail = data.email;
            document.getElementById('otp-email-display').textContent = data.email;
            showPane('otp');
            clearOtp();
            startOtpTimer();
            setMsg(document.getElementById('otp-msg'), data.message, 'info');
          } else {
            /* Success */
            authToken = data.token;
            localStorage.setItem('parsia_token', authToken);
            applyUser(data.user);
            authModal.classList.remove('visible');
            showToast('Signed in as ' + data.user.email, 'ok');
            /* Fire pending callback from landing page */
            if (typeof window._parsiaPostAuth === 'function') {
              window._parsiaPostAuth();
              window._parsiaPostAuth = null;
            }
          }
        } catch (e) {
          setMsg(msgEl, e.message, 'err');
        } finally {
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      });

      /* ═══ SIGN UP ═════════════════════════════════════════ */
      document.getElementById('signup-submit').addEventListener('click', async () => {
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const pass = document.getElementById('signup-pass').value;
        const confirm = document.getElementById('signup-confirm').value;
        const msgEl = document.getElementById('signup-msg');

        if (!email || !pass) { setMsg(msgEl, 'Email and password required.', 'err'); return; }
        if (pass !== confirm) { setMsg(msgEl, 'Passwords do not match.', 'err'); return; }
        if (pass.length < 8) { setMsg(msgEl, 'Password must be at least 8 characters.', 'err'); return; }
        if (checkStrength(pass) < 3) {
          setMsg(msgEl, 'Weak password. Add uppercase, numbers, and special characters.', 'err');
          return;
        }

        const btn = document.getElementById('signup-submit');
        btn.disabled = true;
        btn.classList.add('loading');
        msgEl.className = 'auth-msg';

        try {
          const data = await authFetch('/register', { email, password: pass, name });
          /* Show OTP verification pane */
          pendingOtpEmail = data.email;
          document.getElementById('otp-email-display').textContent = data.email;
          showPane('otp');
          clearOtp();
          startOtpTimer();
          setMsg(document.getElementById('otp-msg'), '✓ ' + data.message, 'ok');
        } catch (e) {
          setMsg(msgEl, e.message, 'err');
        } finally {
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      });

      /* ═══ OTP VERIFY ══════════════════════════════════════ */
      document.getElementById('otp-submit').addEventListener('click', async () => {
        const code = getOtpValue('.auth-otp-digit[data-otp]');
        const msgEl = document.getElementById('otp-msg');

        if (code.length !== 6) { setMsg(msgEl, 'Enter all 6 digits.', 'err'); return; }

        const btn = document.getElementById('otp-submit');
        btn.disabled = true;
        btn.classList.add('loading');

        try {
          const data = await authFetch('/verify-otp', { email: pendingOtpEmail, code });
          authToken = data.token;
          localStorage.setItem('parsia_token', authToken);
          applyUser(data.user);
          authModal.classList.remove('visible');
          showToast('🎉 Email verified! Welcome to Parsia.', 'ok');
          /* Fire pending callback from landing page */
          if (typeof window._parsiaPostAuth === 'function') {
            window._parsiaPostAuth();
            window._parsiaPostAuth = null;
          }
        } catch (e) {
          setMsg(msgEl, e.message, 'err');
        } finally {
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      });

      /* Resend OTP */
      document.getElementById('otp-resend').addEventListener('click', async () => {
        try {
          await authFetch('/resend-otp', { email: pendingOtpEmail });
          setMsg(document.getElementById('otp-msg'), 'New code sent!', 'ok');
          startOtpTimer();
          clearOtp();
        } catch (e) {
          setMsg(document.getElementById('otp-msg'), e.message, 'err');
        }
      });

      /* ═══ FORGOT PASSWORD ═════════════════════════════════ */
      document.getElementById('forgot-submit').addEventListener('click', async () => {
        const email = document.getElementById('forgot-email').value.trim();
        const msgEl = document.getElementById('forgot-msg');
        if (!email) { setMsg(msgEl, 'Email required.', 'err'); return; }

        const btn = document.getElementById('forgot-submit');
        btn.disabled = true;
        btn.classList.add('loading');

        try {
          const data = await authFetch('/forgot-password', { email });
          setMsg(msgEl, data.message, 'ok');
          pendingOtpEmail = email;
          setTimeout(() => showPane('reset'), 2000);
        } catch (e) {
          setMsg(msgEl, e.message, 'err');
        } finally {
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      });

      /* ═══ RESET PASSWORD ══════════════════════════════════ */
      document.getElementById('reset-submit').addEventListener('click', async () => {
        const code = getOtpValue('.auth-otp-digit[data-rotp]');
        const newPass = document.getElementById('reset-pass').value;
        const msgEl = document.getElementById('reset-msg');

        if (code.length !== 6) { setMsg(msgEl, 'Enter all 6 digits.', 'err'); return; }
        if (!newPass || newPass.length < 8) { setMsg(msgEl, 'New password must be at least 8 characters.', 'err'); return; }

        const btn = document.getElementById('reset-submit');
        btn.disabled = true;
        btn.classList.add('loading');

        try {
          const data = await authFetch('/reset-password', { email: pendingOtpEmail, code, new_password: newPass });
          setMsg(msgEl, '✓ ' + data.message, 'ok');
          setTimeout(() => showPane('login'), 2000);
        } catch (e) {
          setMsg(msgEl, e.message, 'err');
        } finally {
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      });

      /* ── User dropdown ───────────────────────────────────── */
      userChip.addEventListener('click', e => {
        e.stopPropagation();
        userDrop.classList.toggle('open');
      });
      document.addEventListener('click', () => userDrop.classList.remove('open'));

      document.getElementById('ud-signout').addEventListener('click', () => {
        authToken = null;
        localStorage.removeItem('parsia_token');
        applyUser(null);
        showToast('Signed out', 'ok');
      });

      document.getElementById('ud-gallery')?.addEventListener('click', () => {
        userDrop.classList.remove('open');
        openGallery();
      });

      /* ── Save story ──────────────────────────────────────── */
      btnSave.addEventListener('click', () => (window._parsiaOnSave || saveCurrentStory)());
      btnGallery.addEventListener('click', openGallery);

      window._parsiaOnCompiled = function (source, animationJson) {
        lastCompiled = { source, animation: animationJson };
        if (currentUser) btnSave.style.display = 'flex';
      };

      async function saveCurrentStory() {
        if (!currentUser || !lastCompiled) return;
        btnSave.disabled = true;
        const { source, animation } = lastCompiled;
        /* Save to localStorage (or Supabase if configured) */
        try {
          const stories = JSON.parse(localStorage.getItem('parsia_stories') || '[]');
          stories.unshift({
            id: Date.now().toString(36),
            user_id: currentUser.id,
            title: (animation.scene || 'Untitled') + ' — ' + new Date().toLocaleDateString(),
            source,
            animation,
            scene: animation.scene || null,
            character_count: animation.characters?.length ?? 0,
            action_count: animation.actions?.length ?? 0,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem('parsia_stories', JSON.stringify(stories));
          showToast('Story saved ✓', 'ok');
        } catch (e) {
          showToast('Save failed: ' + e.message, 'err');
        } finally {
          btnSave.disabled = false;
        }
      }

      /* ── Gallery ──────────────────────────────────────────── */
      async function openGallery() {
        galleryModal.classList.add('visible');
        const stories = JSON.parse(localStorage.getItem('parsia_stories') || '[]')
          .filter(s => currentUser && s.user_id === currentUser.id);
        galleryCount.textContent = stories.length + ' stories';

        if (!stories.length) {
          galleryGrid.innerHTML = '<div class="gallery-empty"><div class="gallery-empty-icon">🎬</div>No stories yet. Create your first animation!</div>';
          return;
        }

        galleryGrid.innerHTML = stories.map((s, idx) => {
          const date = new Date(s.created_at).toLocaleDateString();
          return `<div class="sc-card" data-gidx="${idx}">
            <div class="sc-top"><span>${s.scene || 'Unknown Scene'}</span><span style="margin-left:auto">${date}</span></div>
            <div class="sc-scene">${(s.title || 'Untitled').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
            <div class="sc-meta">
              <span class="sc-badge">⚡ ${s.action_count ?? 0} actions</span>
              <span class="sc-badge">👥 ${s.character_count ?? 0} chars</span>
            </div>
          </div>`;
        }).join('');

        galleryGrid.querySelectorAll('.sc-card').forEach(card => {
          card.addEventListener('click', () => {
            const idx = parseInt(card.dataset.gidx);
            const s = stories[idx];
            if (s?.animation) {
              if (typeof doLoad === 'function') doLoad(s.animation);
              galleryModal.classList.remove('visible');
              if (typeof window.launchApp === 'function') window.launchApp();
            }
          });
        });
      }

      /* close gallery */
      document.getElementById('gallery-close')?.addEventListener('click', () => galleryModal.classList.remove('visible'));
      galleryModal?.addEventListener('click', e => { if (e.target === galleryModal) galleryModal.classList.remove('visible'); });

      /* ── Usage / Pricing ─────────────────────────────────── */
      const plan = currentUser?.role === 'admin' ? 'pro' : 'free';
      const tier = { free: { label: 'Free', limit: 10 }, creator: { label: 'Creator', limit: 100 }, pro: { label: 'Pro', limit: 999 } };
      const t = tier[plan] || tier.free;
      const stories = JSON.parse(localStorage.getItem('parsia_stories') || '[]');
      const used = stories.filter(s => currentUser && s.user_id === currentUser?.id).length;
      const limit = t.limit;

      function updateUsageBar(u, l) {
        const fill = document.getElementById('usage-bar-fill');
        const label = document.getElementById('usage-bar-used');
        if (fill) { fill.style.width = Math.min(100, (u / l) * 100) + '%'; fill.classList.toggle('warn', u / l > 0.8); }
        if (label) label.textContent = `${u} / ${l}`;
      }

      /* Create usage bar if stage pane exists */
      if (!document.getElementById('usage-bar-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'usage-bar-wrap';
        wrap.id = 'usage-bar-wrap';
        wrap.innerHTML = `<div class="usage-bar-label"><span>Monthly Usage</span><span id="usage-bar-used">${used} / ${limit}</span></div><div class="usage-bar-track"><div class="usage-bar-fill" id="usage-bar-fill" style="width:${Math.min(100, (used / limit) * 100)}%"></div></div>`;
        const stagePane = document.getElementById('ins-stage');
        stagePane && stagePane.insertBefore(wrap, stagePane.firstChild);
        updateUsageBar(used, limit);
      }

      function checkUsageAndSave() {
        if (used >= limit) {
          showToast(`Limit reached (${used}/${limit}). Upgrade your plan.`, 'err');
          document.getElementById('pricing-modal')?.classList.add('visible');
          return;
        }
        saveCurrentStory();
      }
      window._parsiaOnSave = checkUsageAndSave;

      /* ── Admin Dashboard ────────────────────────────────── */
      const adminBtn = document.getElementById('ud-admin');
      const adminModal = document.getElementById('admin-modal');

      if (adminBtn && adminModal) {
        adminBtn.addEventListener('click', () => {
          userDrop.classList.remove('open');
          adminModal.classList.add('visible');
          loadAdminStats();
        });
        document.getElementById('admin-close')?.addEventListener('click', () => adminModal.classList.remove('visible'));
        adminModal.addEventListener('click', e => { if (e.target === adminModal) adminModal.classList.remove('visible'); });
      }

      document.getElementById('admin-copy-sql')?.addEventListener('click', () => {
        const sql = document.querySelector('.admin-sql code')?.textContent;
        if (sql) navigator.clipboard.writeText(sql).then(() => showToast('SQL copied ✓', 'ok')).catch(() => { });
      });

      async function loadAdminStats() {
        try {
          const res = await fetch(AUTH_API + '/auth/admin/stats', {
            headers: { 'X-Admin-Key': 'parsia-admin-2024' }
          });
          if (!res.ok) throw new Error('Admin access denied');
          const stats = await res.json();
          document.getElementById('astat-users').textContent = stats.total_users ?? '—';
          document.getElementById('astat-stories').textContent = used ?? '—';
          document.getElementById('astat-public').textContent = stats.verified_users ?? '—';
          document.getElementById('astat-compiles').textContent = stats.total_logins ?? '—';
          document.getElementById('astat-translates').textContent = stats.active_sessions ?? '—';
          document.getElementById('astat-today').textContent = stats.today_registrations ?? '—';
        } catch (e) {
          /* Fallback to API stats */
          try {
            const res = await fetch(AUTH_API + '/stats');
            const stats = await res.json();
            document.getElementById('astat-compiles').textContent = stats.compiles ?? '—';
            document.getElementById('astat-translates').textContent = stats.translates ?? '—';
          } catch (e2) { console.warn('Stats fetch failed'); }
        }

        /* Load recent stories */
        const recentEl = document.getElementById('admin-recent');
        if (recentEl) {
          const allStories = JSON.parse(localStorage.getItem('parsia_stories') || '[]').slice(0, 10);
          recentEl.innerHTML = '';
          allStories.forEach(s => {
            const row = document.createElement('div');
            row.className = 'admin-recent-row';
            row.innerHTML = `
              <span class="admin-recent-scene">${(s.scene || 'Unknown').replace(/</g, '&lt;')}</span>
              <span>⚡${s.action_count ?? 0}</span>
              <span>👥${s.character_count ?? 0}</span>
              <span>${new Date(s.created_at).toLocaleDateString()}</span>`;
            recentEl.appendChild(row);
          });
        }
      }

      /* ── STRIPE CHECKOUT ───────────────────────────────── */
      async function startStripeCheckout(plan) {
        if (!currentUser) {
          showToast('Sign in to subscribe', 'err');
          authModal.classList.add('visible');
          return;
        }
        try {
          showToast('Redirecting to checkout…', 'ok');
          const r = await fetch(AUTH_API + '/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, user_email: currentUser.email }),
          });
          if (!r.ok) throw new Error('Checkout endpoint not available');
          const { url } = await r.json();
          if (url) window.location.href = url;
          else throw new Error('No checkout URL returned');
        } catch (e) {
          showToast('Billing not active yet — ' + e.message, 'err');
        }
      }

      /* Wire pricing modal buttons to Stripe */
      document.querySelectorAll('.tier-btn[data-plan]').forEach(btn => {
        btn.addEventListener('click', () => startStripeCheckout(btn.dataset.plan));
      });

    })();

  