import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { JSONLoader } from 'three/src/loaders/JSONLoader';

export class AssetError {
  constructor(error, path) {
    this.error = error;
    this.path = path;
    this.stack = (new Error()).stack;
  }

  toString() {
    return `Error loading '${this.path}': ${this.error}.`;
  }
}

export class Asset {
  constructor(path) {
    this.path = path;
  }
}

export class ModelAsset extends Asset {
  constructor(path, geometry, material) {
    super(path);
    this.geometry = geometry;
    this.material = material;
  }
}

export class TextureAsset extends Asset {
  constructor(path, texture) {
    super(path);
    this.texture = texture;
    this.texture.anisotropy = 4;
  }
}

export class Loader {
  constructor(root) {
    this.root = root || '';
    this.textureLoader = new TextureLoader();
    this.jsonLoader = new JSONLoader();
    this.cache = {};
    this.typeToMethod = {
      'texture': this.loadTexture,
      'json/model': this.loadModelJSON
    }
  }

  getAsset(path) {
    return this.cache[path];
  }

  loadAssets(assetList, onComplete, onProgress, onError) {
    let loaded = 0;
    let failed = 0;
    let errors = [];
    let total = assetList.length;

    let checkProgress = function(path, asset, error) {
      if(onProgress != null) {
        onProgress(loaded, failed, total, path, asset, error);
      }
      if(loaded + failed == total && onComplete != null) {
        onComplete(errors, total, loaded, failed);
      }
    }

    let loadCb = function(asset) {
      loaded++;
      checkProgress(asset.path, asset, null);
    };

    let errorCb = function(error, path) {
      failed++;
      let err = new AssetError(error, path);
      errors.push(err);
      onError(err);
      checkProgress(path, null, error);
    }

    for(let item of assetList) {
      let {path, type} = item;
      let method = this.typeToMethod[type];
      if(method == null) {
        errorCb(`Unsupported type '${type}'`, path);
      } else {
        method.call(this, path, loadCb, errorCb);
      }
    }
  }

  loadModelJSON(path, loadCb, errorCb) {
    if(this.cache[path] != null) { return this.cache[path]; }
    this.jsonLoader.load(this.resolvePath(path), (geometry, material) => {
      let asset = this.cache[path] = new ModelAsset(path, geometry, material);
      loadCb(asset);
    }, undefined, (error) => { errorCb(error, path); });
  }

  loadTexture(path, loadCb, errorCb) {
    if(this.cache[path] != null) { return this.cache[path]; }
    this.textureLoader.load(this.resolvePath(path), (texture) => {
      let asset = this.cache[path] = new TextureAsset(path, texture);
      loadCb(asset);
    }, undefined, (error) => { errorCb(error, path); });
  }

  resolvePath(path) {
    if(path[0] === '/') {
      path = this.root + path;
    }
    return path;
  }
}
