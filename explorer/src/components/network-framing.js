// Camera framing for schematic networks. Coordinates remain scientifically unchanged.
export function overviewPose(nodes, aspect, fov) {
  const finite = nodes.filter(n => ['x', 'y', 'z'].every(k => Number.isFinite(n[k])));
  if (!finite.length) return {position:{x:0,y:0,z:700},target:{x:0,y:0,z:0}};
  const bounds = Object.fromEntries(['x','y','z'].map(k => [k,[Math.min(...finite.map(n=>n[k])),Math.max(...finite.map(n=>n[k]))]]));
  const target = Object.fromEntries(['x','y','z'].map(k => [k,(bounds[k][0]+bounds[k][1])/2]));
  const tangent = Math.tan(fov * Math.PI / 360);
  // Reserve space around spheres and annotation labels, including narrow phones.
  const distance = (bounds.z[1]-bounds.z[0])/2 + Math.max(
    (bounds.y[1]-bounds.y[0]+140)/(2*tangent),
    (bounds.x[1]-bounds.x[0]+180)/(2*tangent*Math.max(.2,aspect)),
  );
  return {position:{...target,z:target.z+distance},target};
}
export function gentleFocusPose(pose, node, fraction = .2, zoom = .9) {
  const target = Object.fromEntries(['x','y','z'].map(k=>[k,pose.target[k]+(node[k]-pose.target[k])*fraction]));
  const position = Object.fromEntries(['x','y','z'].map(k=>[k,target[k]+(pose.position[k]-pose.target[k])*zoom]));
  return {position,target};
}
