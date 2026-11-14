import {
  Node, Material, Mesh, MeshRenderer, utils, primitives, Color, Vec3, Quat,
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

  constructor(readonly root: Node, private surface: Material, private unlit: Material) {}

  material(hex: string, metallic = 0, roughness = .8): Material {
    const key = `${hex}/${metallic}/${roughness}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new Material();
      material.copy(this.surface);
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
    const sky = this.mesh('Blue evening sky dome', utils.createMesh(primitives.sphere(480, { segments: 48 })), material);
    sky.getComponent(MeshRenderer)!.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
  }

  /** Preserve material boundaries while reducing thousands of static detail draws. */
  batchStatic(): void {
    const groups = new Map<Material, MeshRenderer[]>();
    for (const renderer of this.staticRenderers) {
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
        for (const renderer of chunk) merged.merge(renderer.mesh!, renderer.node.worldMatrix);
        const node = new Node('Static city detail batch');
        this.root.addChild(node);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = merged;
        renderer.setMaterial(material, 0);
        renderer.shadowCastingMode = chunk[0].shadowCastingMode;
        for (const original of chunk) original.node.destroy();
      }
    }
    this.staticRenderers = [];
  }
}
