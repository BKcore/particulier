import { BoxBufferGeometry } from 'three/src/geometries/BoxBufferGeometry';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';
import { RepeatWrapping } from 'three/src/constants';

export class GrayBox {
  static defaultTexture = null;
  static geometries = {
    box: new BoxBufferGeometry(1, 1, 1)
  };

  static setDefaultTexture(texture) {
    GrayBox.defaultTexture = texture;
  }

  static createMaterial(u, v, color) {
    let material = new MeshStandardMaterial({color: 0xffffff});
    material.roughness = 0.5;
    if(color != null) {
      material.color.set(color);
    }
    else if(GrayBox.defaultTexture != null) {
      // TODO: Find a way to share textures while still having different uv repeat params?
      material.map = GrayBox.defaultTexture.clone();
      material.map.wrapS = material.map.wrapT = RepeatWrapping;
      material.map.anisotropy = 4;
      material.map.repeat.set(u / 2, v / 2);
      material.map.needsUpdate = true;
    }
    return material;
  }

  static createMesh(geometry, material, x, y, z, sx, sy, sz, color) {
    let mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  static createBox(x, y, z, sx, sy, sz, color) {
    let geometry = GrayBox.geometries.box;
    let material = GrayBox.createMaterial(sx, sz, color);
    return GrayBox.createMesh(geometry, material, x, y, z, sx, sy, sz, color);
  }
}
