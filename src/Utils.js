export function fInterpTo(value, target, speed, dt)  {
  if(value < target) {
    return Math.min(target, value + speed * dt);
  } else if(value > target) {
    return Math.max(target, value - speed * dt);
  } else {
    return target;
  }
}

export function addScalar2(out, vec, scalar) {
  vec[0] += scalar;
  vec[1] += scalar;
}

export function addScalar3(out, vec, scalar) {
  vec[0] += scalar;
  vec[1] += scalar;
  vec[2] += scalar;
}

export function randomInRange(out, start, end) {
  out[0] = Math.random() * (end[0] - start[0]) + start[0];
  out[1] = Math.random() * (end[1] - start[1]) + start[1];
  out[2] = Math.random() * (end[2] - start[2]) + start[2];
}

export function randomInRange4(out, start, end) {
  out[0] = Math.random() * (end[0] - start[0]) + start[0];
  out[1] = Math.random() * (end[1] - start[1]) + start[1];
  out[2] = Math.random() * (end[2] - start[2]) + start[2];
  out[3] = Math.random() * (end[3] - start[3]) + start[3];
}

export function setVec2At(buffer, i, x, y) {
  buffer[i + 0] = x;
  buffer[i + 1] = y;
}

export function setVec3At(buffer, i, x, y, z) {
  buffer[i + 0] = x;
  buffer[i + 1] = y;
  buffer[i + 2] = z;
}

export function setVec4At(buffer, i, x, y, z, w) {
  buffer[i + 0] = x;
  buffer[i + 1] = y;
  buffer[i + 2] = z;
  buffer[i + 3] = w;
}

export function setVec6At(buffer, i, x, y, z, w, u, v) {
  buffer[i + 0] = x;
  buffer[i + 1] = y;
  buffer[i + 2] = z;
  buffer[i + 3] = w;
  buffer[i + 4] = u;
  buffer[i + 5] = v;
}

export function copyVec2At(buffer, i, v) {
  buffer[i + 0] = v[0];
  buffer[i + 1] = v[1];
}

export function copyVec3At(buffer, i, v) {
  buffer[i + 0] = v[0];
  buffer[i + 1] = v[1];
  buffer[i + 2] = v[2];
}

export function copyVec4At(buffer, i, v) {
  buffer[i + 0] = v[0];
  buffer[i + 1] = v[1];
  buffer[i + 2] = v[2];
  buffer[i + 3] = v[3];
}


export class IterableDict {
  constructor() {
    this.keys = {};
    this.values = [];
  }

  get(key) {
    let idx = this.keys[key];
    if(idx != null) {
      return this.values[idx];
    } else {
      return null;
    }
  }

  set(key, value) {
    let idx = this.keys[key];
    if(idx != null) {
      this.values[idx] = value;
    } else {
      this.keys[key] = this.values.length;
      this.values.push(value);
    }
  }

  delete(key) {
    let idx = this.keys[key];
    if(idx != null) {
      delete this.keys[key];
      this.value.splice(idx, 1);
    }
  }

  clear() {
    this.keys = {};
    this.value.length = 0;
  }
}