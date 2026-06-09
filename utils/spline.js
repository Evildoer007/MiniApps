/**
 * Catmull-Rom 样条插值模块 (小程序版)
 * 从离散数据点生成平滑曲线，用于年化升贴水期限结构
 */

/**
 * Catmull-Rom 样条插值
 */
function catmullRom(points, density) {
  if (density === undefined) density = 20;
  if (!points || points.length < 2) return points || [];

  var sorted = points.slice().sort(function (a, b) { return a.x - b.x; });
  var n = sorted.length;
  var result = [];

  for (var i = 0; i < n - 1; i++) {
    var p0 = sorted[Math.max(0, i - 1)];
    var p1 = sorted[i];
    var p2 = sorted[i + 1];
    var p3 = sorted[Math.min(n - 1, i + 2)];

    var steps = density;

    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      var tt = t * t;
      var ttt = tt * t;

      var x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tt +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * ttt
      );

      var y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tt +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * ttt
      );

      if (i < n - 2 && s === steps) continue;

      result.push({
        x: +x.toFixed(2),
        y: +y.toFixed(4)
      });
    }
  }

  return result;
}

/**
 * 构建期限结构曲线数据
 */
function buildTermStructure(contracts, xMin, xMax, density) {
  if (xMin === undefined) xMin = 0;
  if (xMax === undefined) xMax = 182;
  if (density === undefined) density = 30;

  if (!contracts || contracts.length === 0) return { curve: [], spots: [] };

  var spots = contracts
    .filter(function (c) { return c.annualizedBasis != null; })
    .map(function (c) { return { x: c.days, y: c.annualizedBasis }; })
    .sort(function (a, b) { return a.x - b.x; });

  if (spots.length < 2) return { curve: spots, spots: spots };

  var curve = catmullRom(spots, density);

  // 裁剪到 [xMin, xMax]
  if (xMin != null || xMax != null) {
    curve = curve.filter(function (p) {
      if (xMin != null && p.x < xMin) return false;
      if (xMax != null && p.x > xMax) return false;
      return true;
    });
  }

  return { curve: curve, spots: spots };
}

/**
 * 从样条曲线上取指定 x 处的插值 y
 */
function interpolateAt(curve, targetX) {
  if (!curve || curve.length === 0) return null;

  for (var i = 0; i < curve.length; i++) {
    if (curve[i].x === targetX) return curve[i].y;
  }

  var left = null, right = null;
  for (var i = 0; i < curve.length; i++) {
    var p = curve[i];
    if (p.x <= targetX && (!left || p.x > left.x)) left = p;
    if (p.x >= targetX && (!right || p.x < right.x)) right = p;
  }

  if (!left) return right ? right.y : null;
  if (!right) return left.y;
  if (left.x === right.x) return left.y;

  var t = (targetX - left.x) / (right.x - left.x);
  return +(left.y + t * (right.y - left.y)).toFixed(4);
}

module.exports = {
  catmullRom: catmullRom,
  buildTermStructure: buildTermStructure,
  interpolateAt: interpolateAt
};
