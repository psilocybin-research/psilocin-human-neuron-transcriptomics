"""Illustrative geometry only: no molecular coordinates or measured dimensions."""
import bpy, math
from pathlib import Path
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,colour):
 m=bpy.data.materials.new(name);m.diffuse_color=(*colour,1);return m
def cube(name,location,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
 bevel=o.modifiers.new('Rounded schematic edges','BEVEL');bevel.width=.16;bevel.segments=3
 o.modifiers.new('Smooth normals','WEIGHTED_NORMAL');return o
mem=material('Schematic membrane',(0.18,.35,.44))
for y in [-.3,.3]:cube('Illustrative membrane',(0,y,0),(15,.18,4),mem)
for i,(name,x) in enumerate(zip(['I','II','III','IV','V'],[-5.4,-2.8,0,2.7,5.3])):
 mat=material('Complex '+name,[(.3,.65,.82),(.8,.62,.32),(.4,.7,.63),(.65,.5,.8),(.8,.53,.35)][i])
 o=cube('Complex_'+name,(x,0,0),(1.2,2.1,1.1),mat)
 if name=='I':cube('Complex_I_arm',(x-0.8,1.5,0),(2.8,.9,1.1),mat)
 if name=='V':
  cube('Complex_V_stalk',(x,1.3,0),(.35,1.3,.35),mat)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(x,2.25,0));bpy.context.object.name='Complex_V_head';bpy.context.object.scale=(1.1,.8,1.1);bpy.context.object.data.materials.append(mat)
import argparse, sys
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
path=args.output_dir;path.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(path/'membrane-context.blend'))
bpy.ops.export_scene.gltf(filepath=str(path/'membrane-context.glb'),export_format='GLB',export_apply=True)
print('Exported illustrative membrane GLB')
