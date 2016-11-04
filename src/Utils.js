export function fInterpTo(value, target, speed, dt)  {
  if(value < target) {
    return Math.min(target, value + speed * dt);
  } else if(value > target) {
    return Math.max(target, value - speed * dt);
  } else {
    return target;
  }
}