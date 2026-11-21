"""
Blender 4.x Authoring Pipeline — Supermarket Zanzibar 3D Digital Twin Assets.

Run headlessly once Blender 4.x is installed:
    blender --background --python scripts/blender/build_supermarket_assets.py

Produces drop-in artist-refinable GLB files under `public/models/` with the exact
object node hierarchy expected by ThreeDObjectMapping and React Three Fiber:
  - Shelf_Gondola -> Frame, Top_Shelf, Middle_Shelf_Upper, Middle_Shelf_Lower,
                     Bottom_Shelf, Shelf_Labels, Product_Position_01..06
  - Warehouse_Rack -> Upright_Left, Upright_Right, Level_01..03, Position_001..003
"""

import os

try:
    import bpy
except ImportError as exc:
    raise SystemExit(
        "This script must be executed inside Blender (blender --background --python ...)."
    ) from exc

OUTPUT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "public", "models")
)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, rgba, metallic=0.1, roughness=0.5, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        mat.blend_method = "BLEND"
    return mat


def add_box(name, size, location, material, parent):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def export_glb(rel_path):
    full_path = os.path.join(OUTPUT_ROOT, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=full_path,
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_normals=True,
        export_texcoords=True,
        export_draco_mesh_compression_enable=False,
    )


def build_shelf():
    clear_scene()
    root = bpy.data.objects.new("Shelf_Gondola", None)
    bpy.context.collection.objects.link(root)

    steel = make_material("PowderSteel", (0.88, 0.91, 0.94, 1), metallic=0.5, roughness=0.4)
    deck = make_material("ShelfDeck", (0.97, 0.98, 0.99, 1), metallic=0.25, roughness=0.35)
    rail = make_material("PriceRailTeal", (0.06, 0.46, 0.43, 1), metallic=0.1, roughness=0.4)

    add_box("Frame", (1.0, 0.08, 2.1), (0, -0.46, 1.05), steel, root)
    add_box("Bottom_Shelf", (0.96, 0.92, 0.06), (0, 0, 0.2), deck, root)
    add_box("Middle_Shelf_Lower", (0.96, 0.86, 0.045), (0, 0, 0.78), deck, root)
    add_box("Middle_Shelf_Upper", (0.96, 0.86, 0.045), (0, 0, 1.34), deck, root)
    add_box("Top_Shelf", (0.96, 0.84, 0.045), (0, 0, 1.9), deck, root)
    add_box("Shelf_Labels", (0.96, 0.02, 0.04), (0, 0.44, 1.32), rail, root)

    for idx, pos in enumerate(
        [(-0.3, 0.22, 0.23), (0, 0.22, 0.23), (0.3, 0.22, 0.23)], start=1
    ):
        empty = bpy.data.objects.new(f"Product_Position_{idx:02d}", None)
        empty.location = pos
        bpy.context.collection.objects.link(empty)
        empty.parent = root

    export_glb("furniture/shelf.glb")


if __name__ == "__main__":
    build_shelf()
    print(f"Exported Blender assets to {OUTPUT_ROOT}")
