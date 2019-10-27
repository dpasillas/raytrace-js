Number.prototype.mod = function(n) {
  return ((this%n)+n)%n;
};

let epsilon = 1e-9;

class Quaternion {
  constructor(a, b, c, d) {
    if (a instanceof Vector) {
      this.a = 0;
      this.b = a.x;
      this.c = a.y;
      this.d = a.z;
    } else {
      this.a = a || 0;
      this.b = b || 0;
      this.c = c || 0;
      this.d = d || 0;
    }
  }
  
  multiply(o) {
    return new Quaternion(
      this.a * o.a - this.b * o.b - this.c * o.c - this.d * o.d,
      this.a * o.b + this.b * o.a + this.c * o.d - this.d * o.c,
      this.a * o.c - this.b * o.d + this.c * o.a + this.d * o.b,
      this.a * o.d + this.b * o.c - this.c * o.b + this.d * o.a
    )
  }
  
  normalize() {
    return this.scale(1. / this.norm());
  }
  
  scale(n) {
    this.a *= n;
    this.b *= n;
    this.c *= n;
    this.d *= n;
    return this;
  }
  
  v() {
    let {b, c, d} = this
    return new Vector(b, c, d)
  }
  
  norm() {
    return Math.sqrt(this.a ** 2 + this.b ** 2 + this.c ** 2 + this.d ** 2)
  }
  
  complement() {
    return new Quaternion(this.a, -this.b, -this.c, -this.d)
  }
  
}

class Vector {
  constructor(x, y, z) {
    // let [this.x, this.y, this.z] = [x || 0, y || 0, z || 0]
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }
  
  dot(o) {
    return this.x * o.x + this.y * o.y + this.z * o.z
  }
  
  cross(o) {
    return new Vector(
      this.y * o.z - this.z * o.y,
      this.z * o.x - this.x * o.z,
      this.x * o.y - this.y * o.x
    )
  }
  
  normalize() {
    return this.scale(1. / this.norm());
  }
  
  normalized() {
    return this.scaled(1. / this.norm());
  }
  
  scale(n) {
    this.x *= n;
    this.y *= n;
    this.z *= n;
    return this;
  }
  
  scaled(n) {
    return new Vector(this.x * n, this.y * n, this.z * n);
  }
  
  norm() {
    return Math.sqrt(this.dot(this))
  }
  
  plus(o) {
    return new Vector(this.x + o.x, this.y + o.y, this.z + o.z);
  }
  
  minus(o) {
    return new Vector(this.x - o.x, this.y - o.y, this.z - o.z)
  }
  
  q() {
    return new Quaternion(0, this.x, this.y, this.z);
  }
  
  rotate(o, angle) {
    let q = this.scaled(Math.sin(angle / 2)).q();
    q.a = Math.cos(angle / 2)
    return q.multiply(o.q()).multiply(q.complement()).v();
  }
  
  project(o) {
    return o.scaled(o.dot(this))
  }
  
}

class Renderable {
  constructor(props) {
    let defaults = {
      k_refl: 0,
      c_refl: new Vector(255, 255, 255),
      k_refr: 0,
      c_refr: undefined,
      a_refr: 1,
      k_ambi: 0,
      c_ambi: new Vector(255, 255, 255),
      k_diff: 0,
      c_diff: new Vector(255, 255, 255)
    }
        
    for (var key in defaults) {
      this[key] = props[key];
      if (typeof this[key] == 'undefined') {
        this[key] = defaults[key];
      }
    }
    
    let k_all = this.k_refl + this.k_refr + this.k_ambi + this.k_diff;
    if (k_all > 1) {
      this.k_refl /= k_all;
      this.k_refr /= k_all;
      this.k_ambi /= k_all;
      this.k_diff /= k_all;
    }

  }
  
  reflect(i, d, t, k, r) {
    if (k < 0)
      console.log('Reflect!')
    return traceRay(i, d.plus(d.project(this.normal(i)).scaled(-2)).normalize(), k+1, r);
  }
  
  refract(i, d, t, k, r) {
    if (k < 0)
      console.log('Refract!')
    let n = this.normal(i);
    let theta1 = Math.acos(d.dot(n));
    
    if (k < 0) {
      console.log(`Theta: ${theta1 * 180 / Math.PI}`)
    }
    
    let [r1, r2] = [r, this.a_refr]
    let enter = false;
    if (theta1 >= Math.PI / 2) {
      theta1 = Math.PI - theta1;
      enter = true;
    } else {
      [r1, r2] = [r2, 1]
    }
    
    if (k < 0) {
      console.log(enter? 'enter' : 'exit')
    }
    
    let theta2 = Math.asin(r1 / r2 * Math.sin(theta1));
    
    if (isNaN(theta2)) {
      return this.reflect(i, d, t, k, r);
    }
    
    let rot = d.cross(n).scale(enter ? 1 : -1).normalize();
//    let rot = d.cross(n).normalize();
    
    if (k < 0) {
      console.log(`Rot: ${theta2 - theta1}`)
    }
    let d2 = rot.rotate(d, theta2 - theta1).normalize();
    
    let depth = enter? 0 : Math.pow((t / (this.r * 2)), 10);
    return traceRay(i, d2, k+1, r2).scaled(1 - depth).plus(this.c_refr.scaled(depth))
  }
  
  ambient(i, d, t, k, r) {
    if (k < 0)
      console.log('Ambiate!')
    return this.c_ambi;
  }
  
  diffuse(i, d, t, k, r) {
    if (k < 0)
      console.log('Diffuse!')
    if (this.normal(i).dot(d) > 0) {
      return new Vector(0, 0, 0)
    }
    return this.c_diff.scaled(Math.abs(this.normal(i).dot(lights[0].minus(i).normalize())))
  }
  
  shadow(i, d, t, k, r) {
    let l = 0
    for (let x = 0; x < lights.length; ++x) {
      let d = lights[x].minus(i)
      let ti = d.norm()
      d.normalize()
      var intersects = objs.map(o => o.intersect(i, d, k)).filter(r => !Number.isNaN(r.t) && r.t >= epsilon)
      if(intersects.length == 0) {
        l += 1
      } else {
        let {t, o} = intersects.sort((a, b) => a.t - b.t)[0]
        l += ti < t? 1 : 0
      }
    }
    return l / lights.length
  }
  
  trace(o, d, t, k, r) {
    let pos = o.plus(d.scaled(t));
    
    let exit = this.normal(pos).dot(d) > 0
    
    let result = new Vector(0, 0, 0);
    if (this.k_refl > 0 && !exit) {
      result = result.plus(this.reflect(pos, d, t, k, r).scale(this.k_refl));
    }
    if (this.k_refr > 0) {
      result = result.plus(this.refract(pos, d, t, k, r).scale(exit? 1 : this.k_refr));
    }
    if (this.k_ambi > 0 && !exit) {
      result = result.plus(this.ambient(pos, d, t, k, r).scale(this.k_ambi));
    }
    if (this.k_diff > 0 && !exit) {
      result = result.plus(this.diffuse(pos, d, t, k, r).scale(this.k_diff));
    }
    
    return result;
    
  }
}

class Sphere extends Renderable {
  constructor(props) {
    super(props);
    this.pos = props.pos;
    this.r = props.r
  }
  
  intersect(o, d, k) {
    var sub = o.minus(this.pos)
    var dot = d.dot(sub);
    var l = - dot;
    
    if (k == -1) {
      console.log( dot ** 2 - (sub.norm() ** 2 - this.r ** 2))
    }
    var r = Math.sqrt(dot ** 2 - (sub.norm() ** 2 - this.r ** 2));
    
    if (isNaN(r)) {
      return {t:NaN};
    }
    
    var ans = [(l - r), (l + r)];
    if (ans[0] >= epsilon)
      return {t:ans[0], o:this};
    if (ans[1] >= epsilon)
      return {t:ans[1], o:this};
    return {t:NaN};
  }
  
//  trace(o, d, t, k, r) {
//    let pos = o.plus(d.scaled(t))
//    let norm = pos.minus(this.pos).normalized()
//    
//    return traceRay(pos, d.plus(d.project(norm).scaled(-2)).normalize(), k+1).scaled(0.8)
//    
////    return 'white'
//  }
  
  normal(i) {
    return i.minus(this.pos).normalized();
  }
}

class Plane extends Renderable {
  constructor(props) {
    super(props);
    let {n, p} = props;
    this.n = n;
    this.d = n.dot(p);
    
  }
  
  intersect(o, d) {
    return {t: - (this.d + this.n.dot(o)) / this.n.dot(d), o: this}
  }
  
  normal(i) {
    return this.n;
  }
}

class Checkerboard extends Plane {
  constructor(props) {
    super(props);
  }
  
  trace(o, d, t, k, r) {
    let p = o.plus(d.scaled(t))
    if ( (Math.floor(p.x.mod(200)) < 100) == (Math.floor(p.z.mod(200)) < 100) ) {
      return new Vector(255, 255, 255).scaled(this.shadow(p, d, t, k, r) + 0.5)
    } return new Vector(0, 0, 0)

  }
}

//let s = new Sphere({
//  k_refl: 0.8,
//  k_diff: 0.2,
//  pos: new Vector(-50, 50, 100),
//  r: 50});

let s = new Sphere({
  k_ambi: 0.0,
  k_diff: 0.0,
  k_refl: 0.2,
  c_refr: new Vector(255, 0, 0),
  k_refr: 0.6,
  a_refr: 1.6,
  pos: new Vector(-50, 50, -100),
  r: 50});

let foo = new Sphere({
  k_refl: 0.8,
  k_diff: 0.0,
  k_ambi: 0.2,
  pos: new Vector(50, 50, -100),
  r: 50});

let p = new Checkerboard({
  n: new Vector(0, 1, 0),
  p: new Vector(0, 0, 0)})

let ss = new Plane({
  n: new Vector(0, -1, 0),
  p: new Vector(0, -100, 0),
  k_refl: 0.5
});
    /*new Sphere({
  pos: new Vector(0, 0, 0),
  r: 10000});*/

let bulb = new Sphere({
  pos: new Vector(200, 99, 200),
  r: 50,
  k_ambi: 1,
  k_diff: 0
})

let objs = [s, foo, p, ss]
let lights = [ new Vector(200, 99, 200) ]

function traceRay(pos, dir, k, r) {
  k = k || 0;
  
  if (k > 16) {
    return new Vector(255, 0, 255)
  }
  
  var intersects = objs.map(o => o.intersect(pos, dir, k)).filter(r => !Number.isNaN(r.t) && r.t >= epsilon)
  if(k < 0) {
    console.log(intersects)
  }
  if (intersects.length == 0) {
    return new Vector(0, 255, 255)
  }
  
  let {t, o} = intersects.sort((a, b) => a.t - b.t)[0]
  
  return o.trace(pos, dir, t, k, r);
}

let camPos = new Vector(0, 50, 100);
let camDir = new Vector(0, 0, -1);
let camLeft = new Vector(-1, 0, 0);
let camUp = camDir.cross(camLeft);
let fov = Math.PI / 2
let [w, h] = [1201, 801]

function rayTrace(raster, k) {
  for (let i = 0; i <= w; ++i) {
    for (let j = 0; j <= h; ++j) {
//      let result = new Vector(0, 0, 0);
//      for(let a = -3; a <= 3; a += 2) {
//        for (let b = -3; b <= 3; b += 2) {
//          let dir = camLeft.rotate(
//            camUp.rotate(
//              camDir,
//              (fov / 2) - fov * (i + a/4) / w
//            ),
//            (-fov / 2) * h / w + fov * (j + b/4) / w
//          );
//          
//          result = result.plus(traceRay(camPos, dir.normalized(), k, 1).scaled(1/16))
//        }
//      }
//      
//      raster.setPixel(i, j, result)

      
      let dir = camLeft.rotate(
        camUp.rotate(
          camDir,
          (fov / 2) - fov * i / w
        ),
        (-fov / 2) * h / w + fov * j / w
      );
      
      raster.setPixel(i, j, traceRay(camPos, dir.normalized(), k, 1))
    }
  }
}

colors = {
  'black': [0, 0, 0],
  'white': [255, 255, 255],
  'gray': [127, 127, 127]
};

class Raster {
  constructor(ctx) {
    this.ctx = ctx;
  }

  decompose(color) {
    if (typeof color == 'string') {
      if (color in colors) {
        return colors[color]
      }
      return colors['black']
    }
    if (color instanceof Vector) {
      let {x, y, z} = color;
      return [x, y, z];
    } else {
      return [color.r, color.g, color.b]
    }
  }

  setPixel(x, y, color) {
      let [r, g, b] = this.decompose(color);
      this.ctx.fillStyle = "rgb("+r+","+g+","+b+")";
      this.ctx.fillRect(x,y,1,1);
  }
}

function doIt() {
  var canvas = document.getElementById('canvas');
  var raster = new Raster(canvas.getContext('2d'));

  canvas.onclick = function onClick(e) {
    console.log(e)
    let {offsetX, offsetY} = e;
    let [i, j] = [offsetX, offsetY];
    let dir = camLeft.rotate(
      camUp.rotate(
        camDir,
        (fov / 2) - fov * i / w
      ),
      (-fov / 2) * h / w + fov * j / w
    );
      
    //  raster.setPixel(i, j, traceRay(camPos, dir.normalized(), k, 1))
    traceRay(camPos, dir.normalized(), -10, 1)
  }
  
  rayTrace(raster)
}

window.onload = doIt