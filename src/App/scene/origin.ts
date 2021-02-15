import * as THREE from 'three'

export function easyOrigin(args: any = {}) {
  let group = new THREE.Group()
  group.add(easyLine({ points: [new THREE.Vector3(), new THREE.Vector3(args.distance || 1, 0, 0)] }, { color: 0xff0000 }))
  group.add(easyLine({ points: [new THREE.Vector3(), new THREE.Vector3(0, args.distance || 1, 0)] }, { color: 0x00ff00 }))
  group.add(easyLine({ points: [new THREE.Vector3(), new THREE.Vector3(0, 0, args.distance || 1)] }, { color: 0x0000ff }))
  return group
}

export function easyLine(args: any = {}, matArgs: any = {}) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(args.points), args.material || new THREE.LineBasicMaterial(matArgs))
}

export function easyBox(args: any = {}, matArgs: any = {}) {
  return new THREE.Mesh(new THREE.BoxGeometry(args.width, args.height, args.depth), args.material || easyMaterial(matArgs))
}

export function easyPlane(args: any = {}, matArgs: any = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(args.width, args.height), args.material || easyMaterial(matArgs))
}

export function easySphere(args: any = {}, matArgs: any = {}) {
  return new THREE.Mesh(new THREE.SphereGeometry(args.radius, args.segments, args.segments), args.material || easyMaterial(matArgs));
}

export function easyMaterial(args: any = {}) {
  return new THREE.MeshBasicMaterial(args)
}

export function createLineGeometry(a: THREE.Vector3, b: THREE.Vector3) {
  let geom = new THREE.BufferGeometry().setFromPoints([a, b]);
  return geom
}

export function createCircleGeometry(radius: number, segments: number) {
  let curve = new THREE.EllipseCurve(
    0, 0,
    radius, radius,
    0, 2 * Math.PI,
    false,
    0
  )
  let points = curve.getPoints(segments || radius * 32);
  let geom = new THREE.BufferGeometry().setFromPoints(points);
  geom.rotateX(Math.PI / 2)
  return geom
}