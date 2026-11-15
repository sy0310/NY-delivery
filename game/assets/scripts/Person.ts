import { Node } from 'cc';
import type { ModelGeometry } from './ModelGeometry';

/** Rigid low-poly joints remain independent from the static city batches. */
export class Person {
  readonly node = new Node('Animated person');
  readonly parcelAnchor = new Node('Right hand parcel anchor');
  private body = new Node('Breathing torso');
  private head = new Node('Head joint');
  private arms: Node[] = [];
  private legs: Node[] = [];
  constructor(g: ModelGeometry, parent: Node, color: string, staff = false) {
    parent.addChild(this.node);
    this.node.setPosition(0,.25,0);
    this.node.addChild(this.body);
    this.node.addChild(this.head);
    this.head.setPosition(0,1.56,0);
    const skin = '#bd9476';
    const fabric = g.material(color,0,.9,'grain');
    g.roundedBox('Jacket torso',0,1.08,0,.46,.57,.29,.09,fabric,this.body);
    g.roundedBox('Shirt collar',0,1.34,.14,.13,.08,.025,.012,'#e5dfc9',this.body);
    g.roundedBox('Jacket fastening',0,1.08,.15,.012,.44,.012,.004,'#b4b7a2',this.body);
    g.sphere('Hips',0,.79,0,.40,.25,.28,'#35434a',this.body);
    g.cylinder('Neck',0,1.42,0,.06,.12,skin,this.body);
    if (staff) {
      g.roundedBox('Kitchen apron',0,1.03,.153,.34,.48,.026,.015,'#405b50',this.body);
      g.roundedBox('Apron pocket',0,.98,.17,.21,.12,.018,.008,'#647969',this.body);
    }
    g.sphere('Face and jaw',0,0,.015,.27,.33,.26,skin,this.head);
    g.sphere('Hair',0,.095,-.018,.29,.23,.29,'#493f36',this.head);
    g.sphere('Nose',0,.005,.147,.042,.059,.052,skin,this.head);
    g.roundedBox('Mouth',0,-.072,.143,.065,.012,.01,.004,'#875f4e',this.head);
    if (staff) g.roundedBox('Kitchen cap',0,.157,-.015,.31,.12,.29,.045,'#d8cdb2',this.head);
    for (const side of [-1,1]) {
      g.sphere('Ear',side*.14,0,0,.042,.07,.05,skin,this.head);
      g.sphere('Eye white',side*.06,.04,.135,.04,.022,.017,'#e8e1d0',this.head);
      g.sphere('Iris',side*.06,.04,.146,.016,.019,.008,'#344443',this.head);
      g.roundedBox('Eyebrow',side*.06,.073,.137,.045,.012,.01,.003,'#493f36',this.head);
      const arm = new Node('Shoulder joint');
      this.node.addChild(arm);
      arm.setPosition(side*.275,1.31,0);
      g.roundedBox('Sleeve',0,-.18,0,.16,.39,.18,.06,fabric,arm);
      g.roundedBox('Cuff',0,-.39,.012,.14,.05,.16,.02,'#52615b',arm);
      g.sphere('Hand',0,-.46,.025,.105,.14,.10,skin,arm);
      g.batchStatic(arm);
      this.arms.push(arm);
      const leg = new Node('Hip joint');
      this.node.addChild(leg);
      leg.setPosition(side*.11,.78,0);
      g.roundedBox('Trousers',0,-.32,-.01,.18,.63,.21,.06,'#35434a',leg);
      g.roundedBox('Shoe sole',0,-.72,.04,.20,.05,.32,.022,'#202e32',leg);
      g.roundedBox('Leather shoe',0,-.67,.05,.19,.10,.30,.04,'#39433e',leg);
      g.batchStatic(leg);
      this.legs.push(leg);
    }
    this.arms[1].addChild(this.parcelAnchor);
    this.parcelAnchor.setPosition(0,-.64,.025);
    g.batchStatic(this.body);
    g.batchStatic(this.head);
  }
  animate(time: number, reach = 0, walking = false, headYaw = 0): void {
    this.body.setPosition(0,Math.sin(time*2)*.008,0);
    this.head.setRotationFromEuler(Math.sin(time*1.4)*2,Math.max(-40,Math.min(40,headYaw)),0);
    const swing = walking ? Math.sin(time*8)*25 : Math.sin(time*1.6)*2;
    this.arms[0].setRotationFromEuler(swing,0,5);
    this.arms[1].setRotationFromEuler(-swing-reach*65,0,-5);
    this.legs[0].setRotationFromEuler(walking ? -swing*.8 : 0,0,0);
    this.legs[1].setRotationFromEuler(walking ? swing*.8 : 0,0,0);
  }
}
