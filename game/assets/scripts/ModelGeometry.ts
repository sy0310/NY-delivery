import {
  Node, Material, Mesh, MeshRenderer, utils, primitives, Color, Vec3, Quat, Mat4,
  ImageAsset, Texture2D, gfx,
} from 'cc';

export interface PaintedPanel {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: Texture2D;
  node: Node;
}

/** Shared meshes and materials for the original city and vehicle models. */
export class ModelGeometry {
  private materials = new Map<string, Material>();
  private boxMesh = utils.createMesh(primitives.box());
  private sphereMesh = utils.createMesh(primitives.sphere(.5, { segments: 12 }));
  private cylinderMesh = utils.createMesh(primitives.cylinder(1, 1, 1, { radialSegments: 16 }));
  private staticRenderers: MeshRenderer[] = [];
  private roundedMeshes = new Map<string, Mesh>();

  constructor(readonly root: Node, private surface: Material, private unlit: Material) {}

  material(hex: string, metallic = 0, roughness = .8, finish?: 'grain' | 'brushed'): Material {
    const key = `${hex}/${metallic}/${roughness}/${finish || ''}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new Material();
      material.copy(this.surface);
      if (finish) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const context = canvas.getContext('2d')!;
        const pixels = context.createImageData(128, 128);
        for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
          const shade = finish === 'brushed' ? 234 + y * 47 % 18 + x % 3
            : 230 + (x * 73 + y * 31 + x * y * 13) % 25;
          const offset = (y * 128 + x) * 4;
          pixels.data.set([shade, shade, shade, 255], offset);
        }
        context.putImageData(pixels, 0, 0);
        const texture = new Texture2D();
        texture.image = new ImageAsset(canvas);
        material.copy(this.surface, { defines: { USE_ALBEDO_MAP: true } });
        material.setProperty('mainTexture', texture);
      }
      material.setProperty('mainColor', new Color().fromHEX(hex));
      material.setProperty('metallic', metallic);
      material.setProperty('roughness', roughness);
      this.materials.set(key, material);
    }
    return material;
  }

  mesh(name: string, mesh: Mesh, material: Material, parent: Node = this.root): Node {
    const node = new Node(name);
    parent.addChild(node);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = mesh;
    renderer.setMaterial(material, 0);
    renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.ON;
    if (parent === this.root) this.staticRenderers.push(renderer);
    return node;
  }

  box(name: string, x: number, y: number, z: number, width: number, height: number, depth: number,
    color: string | Material, parent: Node = this.root): Node {
    const material = typeof color === 'string' ? this.material(color) : color;
    const node = this.mesh(name, this.boxMesh, material, parent);
    node.setPosition(x, y, z);
    node.setScale(width, height, depth);
    return node;
  }

  /** Rounded edge normals preserve highlights on close-up interior parts. */
  roundedBox(name: string, x: number, y: number, z: number, width: number, height: number,
    depth: number, radius: number, color: string | Material, parent: Node = this.root): Node {
    const bevel = Math.min(radius, width / 2, height / 2, depth / 2);
    const key = `${width}/${height}/${depth}/${bevel}`;
    let mesh = this.roundedMeshes.get(key);
    if (!mesh) {
      const half = [width / 2, height / 2, depth / 2];
      const core = half.map(value => value - bevel);
      const samples = half.map(value => Array.from(new Set([
        -value, -value + bevel * .25, -value + bevel * .75, -value + bevel,
        value - bevel, value - bevel * .75, value - bevel * .25, value,
      ])));
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
        const uAxis = (axis + 1) % 3;
        const vAxis = (axis + 2) % 3;
        const columns = samples[uAxis].length;
        const rows = samples[vAxis].length;
        const base = positions.length / 3;
        for (const v of samples[vAxis]) for (const u of samples[uAxis]) {
          const point = [0, 0, 0];
          point[axis] = sign * half[axis];
          point[uAxis] = u;
          point[vAxis] = v;
          const closest = point.map((value, index) => Math.max(-core[index], Math.min(core[index], value)));
          const normal = point.map((value, index) => value - closest[index]);
          const length = Math.hypot(...normal);
          for (let index = 0; index < 3; index++) {
            positions.push(closest[index] + normal[index] / length * bevel);
            normals.push(normal[index] / length);
          }
          uvs.push((u / half[uAxis] + 1) / 2, (v / half[vAxis] + 1) / 2);
        }
        for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns - 1; column++) {
          const a = base + row * columns + column;
          const b = a + 1;
          const c = a + columns;
          const d = c + 1;
          if (sign > 0) indices.push(a, b, c, b, d, c);
          else indices.push(a, c, b, b, c, d);
        }
      }
      mesh = utils.createMesh({ positions, normals, uvs, indices });
      this.roundedMeshes.set(key, mesh);
    }
    const node = this.mesh(name, mesh, typeof color === 'string' ? this.material(color) : color, parent);
    node.setPosition(x, y, z);
    return node;
  }

  glassMaterial(tinted = false): Material {
    const key = tinted ? 'tinted-window-glass' : 'windshield-glass';
    const existing = this.materials.get(key);
    if (existing) return existing;
    const material = new Material();
    material.copy(this.surface, {
      technique: 1,
      states: { rasterizerState: { cullMode: gfx.CullMode.NONE } },
    });
    material.setProperty('mainColor', tinted ? new Color(38, 62, 70, 170) : new Color(165, 192, 198, 30));
    material.setProperty('roughness', .15);
    material.setProperty('metallic', .2);
    this.materials.set(key, material);
    return material;
  }

  sphere(name: string, x: number, y: number, z: number, width: number, height: number, depth: number,
    color: string, parent: Node = this.root): Node {
    const node = this.mesh(name, this.sphereMesh, this.material(color), parent);
    node.setPosition(x, y, z);
    node.setScale(width, height, depth);
    return node;
  }

  cylinder(name: string, x: number, y: number, z: number, radius: number, height: number,
    color: string, parent: Node = this.root): Node {
    const node = this.mesh(name, this.cylinderMesh, this.material(color), parent);
    node.setPosition(x, y, z);
    node.setScale(radius, height, radius);
    return node;
  }

  beam(name: string, from: Vec3, to: Vec3, radius: number, color: string, parent: Node = this.root): Node {
    const direction = Vec3.subtract(new Vec3(), to, from);
    const node = this.cylinder(name, (from.x + to.x) / 2, (from.y + to.y) / 2,
      (from.z + to.z) / 2, radius, direction.length(), color, parent);
    node.setRotation(Quat.rotationTo(new Quat(), Vec3.UP, direction.normalize()));
    return node;
  }

  paintedMaterial(canvas: HTMLCanvasElement, lit = false): { material: Material; texture: Texture2D } {
    const texture = new Texture2D();
    texture.image = new ImageAsset(canvas);
    const material = new Material();
    if (lit) {
      material.initialize({ effectAsset: this.surface.effectAsset, defines: { USE_ALBEDO_MAP: true } });
      material.setProperty('roughness', .9);
    } else material.copy(this.unlit);
    material.setProperty('mainTexture', texture);
    return { material, texture };
  }

  panel(name: string, width: number, height: number, pixelWidth: number, pixelHeight: number,
    parent: Node = this.root): PaintedPanel {
    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext('2d')!;
    // Cocos uploads canvas images with the opposite vertical origin to the screen.
    context.translate(0, pixelHeight);
    context.scale(1, -1);
    const { material, texture } = this.paintedMaterial(canvas);
    const node = this.mesh(name, utils.createMesh(primitives.quad()), material, parent);
    node.setScale(width, height, 1);
    node.getComponent(MeshRenderer)!.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
    return { canvas, context, texture, node };
  }

  sky(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#6e8390');
    gradient.addColorStop(.46, '#d9e4e5');
    gradient.addColorStop(.56, '#b7d1e2');
    gradient.addColorStop(1, '#497ba9');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    const painted = this.paintedMaterial(canvas);
    const material = new Material();
    material.copy(painted.material, {
      defines: { USE_TEXTURE: true, CC_USE_FOG: 0 },
      states: {
        rasterizerState: { cullMode: gfx.CullMode.FRONT },
        depthStencilState: { depthWrite: false },
      },
    });
    const sky = this.mesh('Blue evening sky dome', utils.createMesh(primitives.sphere(1100, { segments: 48 })), material);
    sky.setPosition(150, 0, -170);
    sky.getComponent(MeshRenderer)!.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
  }

  /** Preserve material boundaries while reducing thousands of static detail draws. */
  batchStatic(parent: Node = this.root): void {
    const groups = new Map<Material, MeshRenderer[]>();
    const sources = parent === this.root ? this.staticRenderers : parent.children
      .map(node => node.getComponent(MeshRenderer))
      .filter((renderer): renderer is MeshRenderer => renderer !== null
        && renderer.shadowCastingMode === MeshRenderer.ShadowCastingMode.ON);
    for (const renderer of sources) {
      const material = renderer.sharedMaterials[0]!;
      const group = groups.get(material) || [];
      group.push(renderer);
      groups.set(material, group);
    }
    for (const [material, renderers] of groups) {
      for (let offset = 0; offset < renderers.length; offset += 350) {
        const chunk = renderers.slice(offset, offset + 350);
        if (chunk.length < 2) continue;
        const merged = new Mesh();
        for (const renderer of chunk) {
          const transform = Mat4.fromRTS(new Mat4(), renderer.node.rotation,
            renderer.node.position, renderer.node.scale);
          merged.merge(renderer.mesh!, transform);
        }
        const node = new Node('Static city detail batch');
        parent.addChild(node);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = merged;
        renderer.setMaterial(material, 0);
        renderer.shadowCastingMode = chunk[0].shadowCastingMode;
        for (const original of chunk) original.node.destroy();
      }
    }
    if (parent === this.root) this.staticRenderers = [];
  }
}
