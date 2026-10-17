/* ORDO TECH — голографический контур.
   Вращающийся глобус с тремя городами, дугами между ними и сканирующим
   кольцом. Хроматическая кайма, строчная развёртка, лёгкое мерцание.

   Канвас создаётся самим скриптом и кладётся на body (z-index 1):
   фон страницы ниже, секции с z-index 2 — выше. Так голограмма не
   зависит от того, что и когда отрисует React-рантайм. */
(function () {
  'use strict';

  var TINT = {
    champagne: [220, 210, 190],
    chalk:     [236, 234, 228],
    frost:     [169, 187, 194]
  };

  var CITIES = [
    { name: 'БИШКЕК', lat: 42.87, lon: 74.59 },
    { name: 'ДУБАЙ',  lat: 25.20, lon: 55.27 },
    { name: 'ЛОНДОН', lat: 51.51, lon: -0.13 }
  ];
  var LINKS = [[0, 1], [0, 2], [1, 2]];

  // ---------- размещение ----------
  function place(cv) {
    var vw = window.innerWidth, narrow = vw < 900;
    var size = narrow ? Math.min(Math.round(vw * 0.86), 430)
                      : Math.min(Math.round(vw * 0.46), 620);

    var h1 = document.querySelector('h1');
    var hero = h1 && h1.closest ? h1.closest('section') : null;
    var r = hero ? hero.getBoundingClientRect() : null;
    var sy = window.scrollY || document.documentElement.scrollTop || 0;

    var top, left;
    if (r && r.height > 240) {
      top = r.top + sy + (r.height - size) / 2;
      left = narrow ? vw - size * 0.66 : vw - size - Math.max(vw * 0.02, 18);
    } else {                       // герой ещё не отрисован — запасной угол
      top = sy + 150;
      left = narrow ? vw - size * 0.66 : vw - size - 24;
    }

    cv.style.cssText =
      'position:absolute;z-index:1;pointer-events:none;' +
      'opacity:' + (narrow ? 0.3 : 0.95) + ';' +
      'width:' + size + 'px;height:' + size + 'px;' +
      'top:' + Math.round(Math.max(top, sy + 60)) + 'px;' +
      'left:' + Math.round(left) + 'px;';
  }

  function start(cv) {
    var ctx = cv.getContext('2d');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    var A = document.createElement('canvas'), actx = A.getContext('2d');
    var B = document.createElement('canvas'), bctx = B.getContext('2d');
    var scanTile = document.createElement('canvas');
    var W = 0, H = 0, DPR = 1, R = 1, cx = 0, cy = 0, pattern = null;

    function resize() {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      DPR = Math.min(window.devicePixelRatio || 1, 1.75);
      W = Math.round(r.width); H = Math.round(r.height);
      [cv, A, B].forEach(function (c) { c.width = W * DPR; c.height = H * DPR; });
      [ctx, actx, bctx].forEach(function (c) { c.setTransform(DPR, 0, 0, DPR, 0, 0); });
      cx = W / 2; cy = H / 2;
      R = Math.min(W, H) * 0.325;

      scanTile.width = 4; scanTile.height = 4;
      var sc = scanTile.getContext('2d');
      sc.clearRect(0, 0, 4, 4);
      sc.fillStyle = 'rgba(236,234,228,.05)';
      sc.fillRect(0, 0, 4, 1);
      pattern = ctx.createPattern(scanTile, 'repeat');
      return true;
    }

    // ---------- геометрия ----------
    function vec(lat, lon) {
      var a = lat * Math.PI / 180, b = lon * Math.PI / 180;
      return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
    }
    function rot(p, yaw, tilt) {
      var x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
      var z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
      var y = p[1] * Math.cos(tilt) - z * Math.sin(tilt);
      z = p[1] * Math.sin(tilt) + z * Math.cos(tilt);
      return [x, y, z];
    }
    var D = 3.1, F = 2.45;
    function proj(p) {
      var s = F / (p[2] + D);
      return [cx + p[0] * s * R, cy - p[1] * s * R, p[2], s];
    }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function slerp(a, b, t) {
      var d = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
      if (d < 1e-6) return a.slice();
      var s = Math.sin(d), w1 = Math.sin((1 - t) * d) / s, w2 = Math.sin(t * d) / s;
      return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
    }
    function fade(z) { return 0.16 + 0.84 * Math.max(0, Math.min(1, (z + 1) / 2)); }

    var LATS = [-66, -44, -22, 0, 22, 44, 66];

    function poly(c, pts, base, width) {
      for (var i = 0; i < pts.length - 1; i++) {
        var p = pts[i], q = pts[i + 1];
        var a = base * fade((p[2] + q[2]) / 2);
        if (a < 0.012) continue;
        c.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        c.lineWidth = width;
        c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
      }
    }

    function drawObject(t) {
      actx.clearRect(0, 0, W, H);
      actx.globalCompositeOperation = 'lighter';
      actx.lineCap = 'round';

      // стартовый разворот — треугольник городов лицом к зрителю;
      // полный оборот ~70 с, медленно, чтобы не отвлекало от текста
      var yaw = -0.62 + t * 0.00009;
      var tilt = 0.18 + Math.sin(t * 0.00019) * 0.06;

      LATS.forEach(function (lat) {
        var pts = [];
        for (var k = 0; k <= 72; k++) pts.push(proj(rot(vec(lat, k * 5), yaw, tilt)));
        poly(actx, pts, 0.17, 1);
      });
      for (var lon = 0; lon < 360; lon += 30) {
        var mp = [];
        for (var k2 = -90; k2 <= 90; k2 += 5) mp.push(proj(rot(vec(k2, lon), yaw, tilt)));
        poly(actx, mp, 0.13, 1);
      }

      var sl = Math.sin(t * 0.00052) * 74;              // сканирующее кольцо
      var ring = [];
      for (var k3 = 0; k3 <= 72; k3++) ring.push(proj(rot(vec(sl, k3 * 5), yaw, tilt)));
      poly(actx, ring, 0.72, 1.6);

      LINKS.forEach(function (pair, idx) {
        var a = vec(CITIES[pair[0]].lat, CITIES[pair[0]].lon);
        var b = vec(CITIES[pair[1]].lat, CITIES[pair[1]].lon);
        var pts = [];
        for (var k = 0; k <= 48; k++) {
          var u = k / 48, m = slerp(a, b, u), lift = 1 + 0.17 * Math.sin(Math.PI * u);
          pts.push(proj(rot([m[0] * lift, m[1] * lift, m[2] * lift], yaw, tilt)));
        }
        poly(actx, pts, 0.5, 1.15);

        var ph = ((t * 0.00017) + idx * 0.37) % 1;
        var p = pts[Math.floor(ph * 48)];
        var al = 0.95 * fade(p[2]);
        var g = actx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 13);
        g.addColorStop(0, 'rgba(255,255,255,' + (al * 0.8).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        actx.fillStyle = g;
        actx.beginPath(); actx.arc(p[0], p[1], 13, 0, 6.2832); actx.fill();
        actx.fillStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
        actx.beginPath(); actx.arc(p[0], p[1], 1.7, 0, 6.2832); actx.fill();
      });

      var marks = [];
      CITIES.forEach(function (c, i) {
        var p = proj(rot(vec(c.lat, c.lon), yaw, tilt));
        var front = p[2] > -0.1, al = fade(p[2]);
        var pulse = (t * 0.0007 + i * 0.5) % 1;
        if (front) {
          actx.strokeStyle = 'rgba(255,255,255,' + ((1 - pulse) * 0.5 * al).toFixed(3) + ')';
          actx.lineWidth = 1;
          actx.beginPath(); actx.arc(p[0], p[1], 4 + pulse * 17, 0, 6.2832); actx.stroke();
        }
        var g2 = actx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 16);
        g2.addColorStop(0, 'rgba(255,255,255,' + (0.7 * al).toFixed(3) + ')');
        g2.addColorStop(1, 'rgba(255,255,255,0)');
        actx.fillStyle = g2;
        actx.beginPath(); actx.arc(p[0], p[1], 16, 0, 6.2832); actx.fill();
        actx.fillStyle = 'rgba(255,255,255,' + Math.min(1, al * 1.1).toFixed(3) + ')';
        actx.beginPath(); actx.arc(p[0], p[1], 2.4, 0, 6.2832); actx.fill();
        marks.push({ x: p[0], y: p[1], name: c.name, a: front ? al : 0 });
      });

      actx.globalCompositeOperation = 'source-over';
      return marks;
    }

    function tint(rgb, dx, alpha) {
      bctx.globalCompositeOperation = 'source-over';
      bctx.clearRect(0, 0, W, H);
      bctx.drawImage(A, 0, 0, W, H);
      bctx.globalCompositeOperation = 'source-in';
      bctx.fillStyle = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      bctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = alpha;
      ctx.drawImage(B, dx, 0, W, H);
      ctx.globalAlpha = 1;
    }

    var glitchUntil = 0, glitchY = 0, nextGlitch = 2600;

    function frame(t) {
      if (!W && !resize()) return;

      var marks = drawObject(reduce ? 8000 : t);

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var bg = ctx.createRadialGradient(cx, cy + R * 1.15, 0, cx, cy + R * 1.15, R * 1.5);
      bg.addColorStop(0, 'rgba(220,210,190,.085)');
      bg.addColorStop(1, 'rgba(220,210,190,0)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      var flick = reduce ? 1 : 0.93 + 0.07 * Math.sin(t * 0.011) * Math.sin(t * 0.0031);
      var sp = reduce ? 0 : 1.15 + Math.sin(t * 0.0013) * 0.5;
      tint(TINT.champagne, -sp, 0.62 * flick);
      tint(TINT.frost, sp, 0.5 * flick);
      tint(TINT.chalk, 0, 0.78 * flick);

      ctx.globalCompositeOperation = 'source-over';

      ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      marks.forEach(function (m) {
        if (m.a < 0.4) return;
        var a = (m.a - 0.4) / 0.6;
        ctx.strokeStyle = 'rgba(220,210,190,' + (a * 0.3).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(m.x + 5, m.y); ctx.lineTo(m.x + 15, m.y); ctx.stroke();
        ctx.fillStyle = 'rgba(236,234,228,' + (a * 0.62).toFixed(3) + ')';
        ctx.fillText(m.name, m.x + 20, m.y + 0.5);
      });

      if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, W, H); }

      if (!reduce) {
        if (t > nextGlitch) {
          glitchUntil = t + 90 + Math.random() * 70;
          glitchY = Math.random() * H;
          nextGlitch = t + 3200 + Math.random() * 5200;
        }
        if (t < glitchUntil) {
          var gy = Math.round(glitchY * DPR);
          var gh = Math.round((10 + Math.random() * 26) * DPR);
          if (gy + gh > cv.height) gh = cv.height - gy;
          if (gh > 2) {
            try {
              ctx.putImageData(ctx.getImageData(0, gy, cv.width, gh),
                               Math.round((Math.random() * 14 - 7) * DPR), gy);
            } catch (e) { /* не критично */ }
          }
        }
      }
    }

    var visible = true, looping = false;
    function loop(t) {
      if (!visible) { looping = false; return; }
      frame(t);
      if (reduce) { looping = false; return; }
      requestAnimationFrame(loop);
    }
    function run() { if (!looping) { looping = true; requestAnimationFrame(loop); } }

    // любая из этих подписок — удобство, а не необходимость:
    // если что-то из них отвалится, анимация всё равно должна идти
    try {
      if (typeof IntersectionObserver === 'function') {
        new IntersectionObserver(function (es) {
          visible = es[0].isIntersecting;
          if (visible) run();
        }, { threshold: 0 }).observe(cv);
      }
    } catch (e) { visible = true; }
    try {
      document.addEventListener('visibilitychange', function () {
        visible = !document.hidden; if (visible) run();
      });
    } catch (e) {}

    function relayout() { place(cv); W = 0; run(); }
    addEventListener('resize', relayout);
    // герой может доотрисоваться позже рантайма — пересчитываем положение
    [250, 900, 2500].forEach(function (ms) { setTimeout(relayout, ms); });

    run();
    try { console.log('[ordo-holo] запущена'); } catch (e) {}
  }

  function init() {
    var cv = document.getElementById('ordo-holo');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'ordo-holo';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
    }
    place(cv);
    start(cv);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
