/* ORDO TECH — «контур»: светящийся трилистник, по которому бесконечно
   идут пакеты данных. Замкнутая петля, которая работает сама — ровно то,
   что компания продаёт.

   Канвас создаётся скриптом и кладётся на body (z-index 1): фон страницы
   ниже, секции с z-index 2 — выше. Привязан к текстовому блоку героя,
   поэтому никогда не наезжает на то, что идёт следом. */
(function () {
  'use strict';

  var TINT = {
    champagne: [220, 210, 190],
    chalk:     [236, 234, 228],
    frost:     [169, 187, 194]
  };

  // ---------- где стоять ----------
  function geom() {
    var h1 = document.querySelector('h1');
    var block = h1 && h1.parentElement;
    var cont = block && block.parentElement;
    if (!block || !cont) return null;
    var r = block.getBoundingClientRect();
    var c = cont.getBoundingClientRect();
    if (r.height < 80) return null;
    return { r: r, c: c };
  }

  function place(cv) {
    var vw = window.innerWidth;
    var sy = window.scrollY || document.documentElement.scrollTop || 0;
    var g = geom();
    var size, left, top, op;

    if (g && vw >= 1000) {
      var gap = Math.max(40, vw * 0.03);
      left = g.r.right + gap;
      var avail = Math.max(0, g.c.right - left);
      // не выше текстового блока и не шире свободного места справа
      size = Math.min(avail, g.r.height * 1.12, 560);
      top = g.r.top + sy + (g.r.height - size) / 2;
      op = 0.95;
      if (size < 260) {                 // места мало — уводим за правый край
        size = Math.min(520, vw * 0.5);
        left = vw - size * 0.78;
        op = 0.4;
      }
    } else if (g) {                     // узкий экран — фоном за текстом
      size = Math.min(vw * 0.92, 440);
      left = vw - size * 0.62;
      top = g.r.top + sy - size * 0.08;
      op = 0.26;
    } else {
      size = Math.min(vw * 0.4, 460);
      left = vw - size - 24;
      top = sy + 150;
      op = 0.6;
    }

    cv.style.cssText =
      'position:absolute;z-index:1;pointer-events:none;' +
      'opacity:' + op + ';' +
      'width:' + Math.round(size) + 'px;height:' + Math.round(size) + 'px;' +
      'top:' + Math.round(top) + 'px;left:' + Math.round(left) + 'px;';
  }

  function start(cv) {
    var ctx = cv.getContext('2d');
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    var A = document.createElement('canvas'), actx = A.getContext('2d');
    var B = document.createElement('canvas'), bctx = B.getContext('2d');
    var tile = document.createElement('canvas');
    var W = 0, H = 0, DPR = 1, R = 1, cx = 0, cy = 0, pattern = null;

    function resize() {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      DPR = Math.min(window.devicePixelRatio || 1, 1.75);
      W = Math.round(r.width); H = Math.round(r.height);
      [cv, A, B].forEach(function (c) { c.width = W * DPR; c.height = H * DPR; });
      [ctx, actx, bctx].forEach(function (c) { c.setTransform(DPR, 0, 0, DPR, 0, 0); });
      cx = W / 2; cy = H / 2; R = Math.min(W, H) * 0.335;

      tile.width = 4; tile.height = 4;
      var sc = tile.getContext('2d');
      sc.clearRect(0, 0, 4, 4);
      sc.fillStyle = 'rgba(236,234,228,.05)';
      sc.fillRect(0, 0, 4, 1);
      pattern = ctx.createPattern(tile, 'repeat');
      return true;
    }

    // ---------- геометрия: торический узел (2,3) ----------
    var SEG = 360;
    function knot(u) {                      // u ∈ [0,1)
      var t = u * Math.PI * 2, c = 2 + Math.cos(3 * t);
      return [0.40 * c * Math.cos(2 * t), 0.40 * c * Math.sin(2 * t), 0.62 * Math.sin(3 * t)];
    }
    function rot(p, yaw, tilt) {
      var x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
      var z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
      var y = p[1] * Math.cos(tilt) - z * Math.sin(tilt);
      z = p[1] * Math.sin(tilt) + z * Math.cos(tilt);
      return [x, y, z];
    }
    var D = 3.6, F = 2.6;
    function proj(p) {
      var s = F / (p[2] + D);
      return [cx + p[0] * s * R, cy - p[1] * s * R, p[2], s];
    }
    function depth(z) { return 0.14 + 0.86 * Math.max(0, Math.min(1, (z + 1.3) / 2.6)); }

    var NODES = [0.0, 0.1667, 0.3333, 0.5, 0.6667, 0.8333];
    var PACKETS = [];
    for (var i = 0; i < 16; i++) {
      PACKETS.push({ u: i / 16, v: 0.00013 + Math.random() * 0.00009 });
    }

    function drawObject(t) {
      actx.clearRect(0, 0, W, H);
      actx.globalCompositeOperation = 'lighter';
      actx.lineCap = 'round';

      var yaw = t * 0.00011;
      var tilt = 0.42 + Math.sin(t * 0.00017) * 0.09;

      // точки кривой
      var pts = new Array(SEG + 1);
      for (var k = 0; k <= SEG; k++) pts[k] = proj(rot(knot(k / SEG), yaw, tilt));

      // сегменты рисуем от дальних к ближним — дальние просвечивают
      var order = [];
      for (var s = 0; s < SEG; s++) order.push(s);
      order.sort(function (a, b) { return pts[a][2] - pts[b][2]; });

      order.forEach(function (s) {
        var p = pts[s], q = pts[s + 1];
        var d = depth((p[2] + q[2]) / 2);
        actx.strokeStyle = 'rgba(255,255,255,' + (0.055 + d * 0.5).toFixed(3) + ')';
        actx.lineWidth = 0.6 + d * 3.1;
        actx.beginPath(); actx.moveTo(p[0], p[1]); actx.lineTo(q[0], q[1]); actx.stroke();
      });

      // узлы — станции на контуре
      NODES.forEach(function (u, i) {
        var p = proj(rot(knot((u + t * 0.00002) % 1), yaw, tilt));
        var d = depth(p[2]);
        var pulse = (t * 0.0006 + i * 0.17) % 1;
        actx.strokeStyle = 'rgba(255,255,255,' + ((1 - pulse) * 0.34 * d).toFixed(3) + ')';
        actx.lineWidth = 1;
        actx.beginPath(); actx.arc(p[0], p[1], 3 + pulse * 20 * d, 0, 6.2832); actx.stroke();
        actx.fillStyle = 'rgba(255,255,255,' + (0.8 * d).toFixed(3) + ')';
        actx.beginPath(); actx.arc(p[0], p[1], 1.6 + d * 1.4, 0, 6.2832); actx.fill();
      });

      // пакеты данных идут по контуру без остановки
      PACKETS.forEach(function (pk) {
        if (!reduce) { pk.u += pk.v; if (pk.u > 1) pk.u -= 1; }
        var p = proj(rot(knot(pk.u), yaw, tilt));
        var d = depth(p[2]), rr = 1.2 + d * 2.2;
        var g = actx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr * 8);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.5 * d).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        actx.fillStyle = g;
        actx.beginPath(); actx.arc(p[0], p[1], rr * 8, 0, 6.2832); actx.fill();
        actx.fillStyle = 'rgba(255,255,255,' + Math.min(1, d * 1.2).toFixed(3) + ')';
        actx.beginPath(); actx.arc(p[0], p[1], rr, 0, 6.2832); actx.fill();
      });

      // тонкое кольцо-рамка вокруг объекта
      actx.strokeStyle = 'rgba(255,255,255,.07)';
      actx.lineWidth = 1;
      actx.beginPath(); actx.ellipse(cx, cy, R * 1.30, R * 1.30 * 0.30, 0, 0, 6.2832); actx.stroke();

      actx.globalCompositeOperation = 'source-over';
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

    var glitchUntil = 0, glitchY = 0, nextGlitch = 3000;

    function frame(t) {
      if (!W && !resize()) return;

      drawObject(reduce ? 9000 : t);

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.1);
      bg.addColorStop(0, 'rgba(220,210,190,.07)');
      bg.addColorStop(1, 'rgba(220,210,190,0)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      var flick = reduce ? 1 : 0.94 + 0.06 * Math.sin(t * 0.011) * Math.sin(t * 0.0031);
      var sp = reduce ? 0 : 1.1 + Math.sin(t * 0.0013) * 0.45;
      tint(TINT.champagne, -sp, 0.6 * flick);
      tint(TINT.frost, sp, 0.48 * flick);
      tint(TINT.chalk, 0, 0.8 * flick);

      ctx.globalCompositeOperation = 'source-over';
      if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, W, H); }

      if (!reduce) {
        if (t > nextGlitch) {
          glitchUntil = t + 80 + Math.random() * 60;
          glitchY = Math.random() * H;
          nextGlitch = t + 4000 + Math.random() * 6000;
        }
        if (t < glitchUntil) {
          var gy = Math.round(glitchY * DPR);
          var gh = Math.round((8 + Math.random() * 22) * DPR);
          if (gy + gh > cv.height) gh = cv.height - gy;
          if (gh > 2) {
            try {
              ctx.putImageData(ctx.getImageData(0, gy, cv.width, gh),
                               Math.round((Math.random() * 12 - 6) * DPR), gy);
            } catch (e) {}
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

    try {
      if (typeof IntersectionObserver === 'function') {
        new IntersectionObserver(function (es) {
          visible = es[0].isIntersecting; if (visible) run();
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
    // герой дорисовывается рантаймом позже — пересчитываем положение
    [200, 700, 1800, 3500].forEach(function (ms) { setTimeout(relayout, ms); });

    run();
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
