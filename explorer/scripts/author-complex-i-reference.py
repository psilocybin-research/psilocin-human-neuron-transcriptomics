"""Local Molecular Nodes evaluation from the same hash-pinned 9TI4 coordinates."""
import sys, json, hashlib, math
from pathlib import Path
import bpy
import molecularnodes as mn
from mathutils import Vector
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
base=args.output_dir;base.mkdir(parents=True,exist_ok=True)
mn.register()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=args.source_dir/'9TI4.cif'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='03dbc44e1f478745601b4939abe3ee84bc6f80a09f57a4f208080c8c8dd64415'
mol=mn.Molecule.load(source,name='9TI4_reference_assembly_1')
# The audited assembly contains identity transforms only; assembly=True retains source metadata.
mol.add_style('cartoon',color='common',assembly=True,quality=1)
obj=mol.object
# Preserve procedural source nodes and realize their instances only at the export boundary.
for modifier in obj.modifiers:
 if modifier.type!='NODES':continue
 tree=modifier.node_group
 output=next(n for n in tree.nodes if n.bl_idname=='NodeGroupOutput' and n.is_active_output)
 socket=next(i for i in output.inputs if i.type=='GEOMETRY')
 if socket.links:
  upstream=socket.links[0].from_socket
  realize=tree.nodes.new('GeometryNodeRealizeInstances')
  tree.links.new(upstream,realize.inputs['Geometry']);tree.links.new(realize.outputs['Geometry'],socket)
bpy.context.view_layer.update()
ca=mol.universe.select_atoms('protein and name CA')
audit={'blender':bpy.app.version_string,'source':'https://files.rcsb.org/download/9TI4.cif.gz','decompressedSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'atoms':len(mol.universe.atoms),'proteinCAlpha':len(ca),'proteinChainIds':sorted(set(ca.chainIDs)),'molecularNodes':'520.2.0','representation':'cartoon, reference anatomy only; no RNA colours or invented coordinates'}
# Match chain labels to audited source memberships, never infer gene identities from spatial positions.
chains=json.loads((Path(__file__).resolve().parents[1]/'src/assets/mitochondria/complex-i.json').read_text())['chains']
expected={c['author'] for c in chains}
assert set(ca.chainIDs)==expected, (set(ca.chainIDs)-expected, expected-set(ca.chainIDs))
audit['auditedProteinChains']=len(expected)
# Materialized mesh bounds give a camera independent of source coordinate origin.
deps=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(deps)
mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=deps)
audit['meshValidationRepaired']=mesh.validate(verbose=True,clean_customdata=False)
preview=bpy.data.objects.new('9TI4_coordinate_cartoon_preview',mesh);bpy.context.collection.objects.link(preview)
obj.hide_render=True;obj.hide_set(True)
# Identity transforms only; instance realization can be required for downstream GLB export.
if not mesh.vertices:
 raise RuntimeError('Molecular Nodes returned instance-only geometry; realization is required before export')
points=[preview.matrix_world @ v.co for v in mesh.vertices];lo=Vector(tuple(min(p[a] for p in points) for a in range(3)));hi=Vector(tuple(max(p[a] for p in points) for a in range(3)));centre=(lo+hi)/2;extent=max(hi-lo)
bpy.ops.object.camera_add(location=centre+Vector((extent*.9,-extent*1.6,extent*.8)));cam=bpy.context.object;cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=extent*1.8;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=centre+Vector((extent,-extent,extent*1.4)));bpy.context.object.data.energy=extent**2*1000;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=extent
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.08,.12,.18,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
scene.render.filepath=str(base/'9TI4-molecular-nodes.png')
bpy.ops.wm.save_as_mainfile(filepath=str(base/'9TI4-molecular-nodes.blend'))
preview.select_set(True);bpy.context.view_layer.objects.active=preview
for o in bpy.context.selected_objects:
 if o!=preview:o.select_set(False)
bpy.ops.export_scene.gltf(filepath=str(base/'9TI4-molecular-nodes.glb'),export_format='GLB',use_selection=True,export_apply=True)
audit.update(vertices=len(mesh.vertices),polygons=len(mesh.polygons));(base/'molecular-nodes-audit.json').write_text(json.dumps(audit,indent=2))
bpy.ops.render.render(write_still=True)
print(json.dumps(audit),flush=True)
