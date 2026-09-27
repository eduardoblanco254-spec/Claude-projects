"""Construye la casa en Blender a partir del plano (DISTRIBUCIÓN DE PLANTA GENERAL).

Uso:
    python build_house.py                  # construye y guarda casa.blend
    python build_house.py --render panos   # además renderiza las panorámicas 360°
    python build_house.py --render views   # además renderiza vistas fijas

Coordenadas del plano: x hacia la derecha (eje A→D), z hacia abajo (fila 5→1), en metros.
En Blender: X = x, Y = -z, Z = altura.
"""
import bpy, bmesh, math, random, sys, os, addon_utils
from mathutils import Vector

random.seed(7)
OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]

# ---------------------------------------------------------------- plan axes
A, B, C, D = 0.0, 4.05, 7.10, 11.40
R5, R4, R3, R1 = 0.0, 3.65, 5.25, 8.50
H = 3.0
LOT_X0, LOT_X1 = -7.0, 19.8
def zS(x): return 21 - .25 * (x + 7)          # south lot line (slanted)
GAR = dict(x0=-7.0, x1=0.0, z0=0.0, z1=6.5)   # garage beside wall A

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('cycles', default_set=True)
sc = bpy.context.scene
root = sc.collection
def new_coll(name):
    c = bpy.data.collections.new(name); root.children.link(c); return c
COL = {n: new_coll(n) for n in ['Estructura', 'Techos', 'Pisos', 'Mobiliario', 'Garaje', 'Exterior', 'Luces', 'Camaras']}
cur = [COL['Estructura']]
def into(name): cur[0] = COL[name]

# ---------------------------------------------------------------- materials
def mat_nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m, nt, bsdf

def simple(name, color, rough=.5, metal=0., **kw):
    m, nt, b = mat_nodes(name)
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    for k, v in kw.items():
        b.inputs[k].default_value = (*v, 1) if isinstance(v, tuple) and len(v) == 3 else v
    m.diffuse_color = (*color, 1)
    return m

def coords(nt, kind='world'):
    if kind == 'world':
        g = nt.nodes.new('ShaderNodeNewGeometry'); return g.outputs['Position']
    t = nt.nodes.new('ShaderNodeTexCoord'); return t.outputs['Object']

def ramp(nt, fac, stops):
    r = nt.nodes.new('ShaderNodeValToRGB'); cr = r.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]:
        e = cr.elements.new(p); e.color = (*c, 1)
    nt.links.new(fac, r.inputs[0]); return r.outputs[0]

def noise(nt, vec, scale, detail=6, rough=.55, dist=0.):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
    n.inputs['Distortion'].default_value = dist; nt.links.new(vec, n.inputs['Vector']); return n.outputs['Fac']

def bump(nt, b, height, strength, dist=.02):
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = dist
    nt.links.new(height, bp.inputs['Height']); nt.links.new(bp.outputs[0], b.inputs['Normal'])

def math_node(nt, op, a, bval=None, clamp=False):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
    if isinstance(a, float): n.inputs[0].default_value = a
    else: nt.links.new(a, n.inputs[0])
    if bval is not None:
        if isinstance(bval, float): n.inputs[1].default_value = bval
        else: nt.links.new(bval, n.inputs[1])
    return n.outputs[0]

def polished(name, stops, scale=.35, rough=.28, coat=.5):
    """Cemento pulido pigmentado (como en las fotos)."""
    m, nt, b = mat_nodes(name); p = coords(nt)
    n1 = noise(nt, p, scale, 8, .62, .4); n2 = noise(nt, p, 3.0, 4, .5)
    col = ramp(nt, n1, stops)
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = .25
    nt.links.new(col, mix.inputs[6]); nt.links.new(ramp(nt, n2, [(0, (.75, .75, .75)), (1, (1, 1, 1))]), mix.inputs[7])
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    nt.links.new(math_node(nt, 'MULTIPLY_ADD', n2, .25, ), b.inputs['Roughness'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = .08
    bump(nt, b, noise(nt, p, 25, 4), .03)
    m.diffuse_color = (*stops[1][1], 1)
    return m

def wall_paint(name, color, rough=.85, stain=0.):
    m, nt, b = mat_nodes(name); p = coords(nt)
    n = noise(nt, p, 1.2, 5, .5)
    col = ramp(nt, n, [(0, tuple(c * (1 - stain * .6) for c in color)), (.6, color), (1, color)])
    nt.links.new(col, b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    bump(nt, b, noise(nt, p, 40, 3), .015)
    m.diffuse_color = (*color, 1); return m

def rough_render(name):
    m, nt, b = mat_nodes(name); p = coords(nt)
    n = noise(nt, p, .8, 8, .65, .6)
    col = ramp(nt, n, [(0, (.13, .12, .10)), (.45, (.30, .28, .24)), (.7, (.42, .40, .35)), (1, (.5, .48, .43))])
    nt.links.new(col, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .95
    bump(nt, b, noise(nt, p, 18, 6, .7), .35)
    m.diffuse_color = (.35, .33, .29, 1); return m

def brick_wall(name):
    """Muro del lote: bloques de concreto con franja de ladrillo rojo (fotos del patio)."""
    m, nt, b = mat_nodes(name); p = coords(nt, 'object')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(p, sep.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(math_node(nt, 'ADD', sep.outputs[0], sep.outputs[1]), comb.inputs[0]); nt.links.new(sep.outputs[2], comb.inputs[1])
    def brick(c1, c2, w, h):
        t = nt.nodes.new('ShaderNodeTexBrick'); t.inputs['Scale'].default_value = 1
        t.inputs['Brick Width'].default_value = w; t.inputs['Row Height'].default_value = h
        t.inputs['Mortar Size'].default_value = .012
        t.inputs['Color1'].default_value = (*c1, 1); t.inputs['Color2'].default_value = (*c2, 1)
        t.inputs['Mortar'].default_value = (.35, .34, .32, 1)
        nt.links.new(comb.outputs[0], t.inputs['Vector']); return t
    clay = brick((.42, .12, .06), (.34, .09, .05), .25, .08)
    block = brick((.36, .35, .32), (.30, .29, .27), .40, .20)
    band = math_node(nt, 'MULTIPLY', math_node(nt, 'GREATER_THAN', sep.outputs[2], -.35), math_node(nt, 'LESS_THAN', sep.outputs[2], .35))
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(band, mix.inputs['Factor']); nt.links.new(block.outputs[0], mix.inputs[6]); nt.links.new(clay.outputs[0], mix.inputs[7])
    grime = nt.nodes.new('ShaderNodeMix'); grime.data_type = 'RGBA'; grime.blend_type = 'MULTIPLY'
    nt.links.new(noise(nt, p, .6, 5), grime.inputs['Factor']); nt.links.new(mix.outputs[2], grime.inputs[6])
    grime.inputs[7].default_value = (.7, .68, .64, 1)
    nt.links.new(grime.outputs[2], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .95
    mfac = nt.nodes.new('ShaderNodeMix'); mfac.data_type = 'FLOAT'
    nt.links.new(band, mfac.inputs['Factor']); nt.links.new(block.outputs['Fac'], mfac.inputs[2]); nt.links.new(clay.outputs['Fac'], mfac.inputs[3])
    bump(nt, b, math_node(nt, 'SUBTRACT', 1.0, mfac.outputs[0]), .5)
    m.diffuse_color = (.35, .3, .27, 1); return m

def planks(name):
    """Techo de tablas de madera (dormitorio principal)."""
    m, nt, b = mat_nodes(name); p = coords(nt)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(p, sep.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(sep.outputs[0], comb.inputs[0]); nt.links.new(sep.outputs[1], comb.inputs[1])
    t = nt.nodes.new('ShaderNodeTexBrick'); t.inputs['Scale'].default_value = 1
    t.inputs['Brick Width'].default_value = 2.4; t.inputs['Row Height'].default_value = .14; t.inputs['Mortar Size'].default_value = .006
    t.inputs['Color1'].default_value = (.30, .10, .04, 1); t.inputs['Color2'].default_value = (.22, .07, .03, 1)
    t.inputs['Mortar'].default_value = (.05, .02, .01, 1)
    nt.links.new(comb.outputs[0], t.inputs['Vector'])
    w = nt.nodes.new('ShaderNodeTexWave'); w.wave_type = 'BANDS'; w.bands_direction = 'X'
    w.inputs['Scale'].default_value = 6; w.inputs['Distortion'].default_value = 8; w.inputs['Detail'].default_value = 3
    nt.links.new(comb.outputs[0], w.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = .35
    nt.links.new(t.outputs[0], mix.inputs[6]); nt.links.new(w.outputs[0], mix.inputs[7])
    nt.links.new(mix.outputs[2], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .55
    bump(nt, b, t.outputs['Fac'], .3)
    m.diffuse_color = (.3, .1, .04, 1); return m

def tiles(name, size, c1, c2, grout, rough=.12):
    m, nt, b = mat_nodes(name); p = coords(nt, 'object')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(p, sep.inputs[0])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(math_node(nt, 'ADD', sep.outputs[0], sep.outputs[1]), comb.inputs[0]); nt.links.new(math_node(nt, 'ADD', sep.outputs[2], sep.outputs[1]), comb.inputs[1])
    t = nt.nodes.new('ShaderNodeTexBrick'); t.offset = 0; t.inputs['Scale'].default_value = 1
    t.inputs['Brick Width'].default_value = size; t.inputs['Row Height'].default_value = size; t.inputs['Mortar Size'].default_value = .004
    t.inputs['Color1'].default_value = (*c1, 1); t.inputs['Color2'].default_value = (*c2, 1); t.inputs['Mortar'].default_value = (*grout, 1)
    t.inputs['Bias'].default_value = -.2
    nt.links.new(comb.outputs[0], t.inputs['Vector'])
    nt.links.new(t.outputs[0], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    bump(nt, b, math_node(nt, 'SUBTRACT', 1.0, t.outputs['Fac']), .25)
    m.diffuse_color = (*c1, 1); return m

def terrazzo(name):
    m, nt, b = mat_nodes(name); p = coords(nt)
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 90; nt.links.new(p, v.inputs['Vector'])
    col = ramp(nt, noise(nt, p, 140, 2), [(0, (.18, .16, .13)), (.4, (.45, .41, .35)), (.55, (.62, .58, .5)), (1, (.8, .77, .7))])
    nt.links.new(col, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .3
    b.inputs['Coat Weight'].default_value = .4
    m.diffuse_color = (.5, .46, .4, 1); return m

def ground(name, stops, scale, bstr, rough=1.):
    m, nt, b = mat_nodes(name); p = coords(nt)
    n = noise(nt, p, scale, 8, .65, .3)
    nt.links.new(ramp(nt, n, stops), b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 60; nt.links.new(p, v.inputs['Vector'])
    bump(nt, b, math_node(nt, 'ADD', v.outputs['Distance'], noise(nt, p, 8, 4)), bstr)
    m.diffuse_color = (*stops[1][1], 1); return m

def glass(name, tint=(.9, .95, .95), rough=0.):
    m, nt, b = mat_nodes(name)
    b.inputs['Base Color'].default_value = (*tint, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Transmission Weight'].default_value = 1; b.inputs['IOR'].default_value = 1.45
    # que la luz del sol atraviese el vidrio sin necesitar cáusticas
    out = nt.nodes['Material Output']; lp = nt.nodes.new('ShaderNodeLightPath')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Shadow Ray'], mix.inputs[0]); nt.links.new(b.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs[0])
    m.diffuse_color = (*tint, .3); return m

def emission(name, color, strength):
    m, nt, b = mat_nodes(name)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = strength
    m.diffuse_color = (*color, 1); return m

def foliage(name):
    """Paneles de follaje artificial del tragaluz, con huecos por donde entra la luz."""
    m, nt, b = mat_nodes(name); p = coords(nt)
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 28; nt.links.new(p, v.inputs['Vector'])
    col = ramp(nt, noise(nt, p, 30, 4), [(0, (.02, .08, .01)), (.5, (.08, .25, .03)), (1, (.2, .45, .06))])
    nt.links.new(col, b.inputs['Base Color']); b.inputs['Roughness'].default_value = .6
    b.inputs['Subsurface Weight'].default_value = .15
    bump(nt, b, v.outputs['Distance'], .8)
    holes = math_node(nt, 'GREATER_THAN', noise(nt, p, 22, 2), .62)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader'); out = nt.nodes['Material Output']
    nt.links.new(holes, mix.inputs[0]); nt.links.new(b.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0]); m.diffuse_color = (.08, .25, .03, 1); return m

def striped(name, base, stripe, scale):
    m, nt, b = mat_nodes(name); p = coords(nt, 'object')
    w = nt.nodes.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = scale; w.inputs['Distortion'].default_value = 6
    nt.links.new(p, w.inputs['Vector'])
    nt.links.new(ramp(nt, w.outputs['Fac'], [(0, base), (.7, base), (.8, stripe), (1, stripe)]), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .9; b.inputs['Sheen Weight'].default_value = .5
    m.diffuse_color = (*base, 1); return m

def corrugated(name):
    m, nt, b = mat_nodes(name); p = coords(nt)
    w = nt.nodes.new('ShaderNodeTexWave'); w.bands_direction = 'Y'; w.wave_profile = 'SIN'
    w.inputs['Scale'].default_value = 1.6; nt.links.new(p, w.inputs['Vector'])
    b.inputs['Base Color'].default_value = (.03, .2, .07, 1); b.inputs['Roughness'].default_value = .55
    bump(nt, b, w.outputs['Fac'], .6, .05); m.diffuse_color = (.02, .22, .14, 1); return m

def leaves(name, c1, c2):
    m, nt, b = mat_nodes(name); p = coords(nt)
    nt.links.new(ramp(nt, noise(nt, p, 6, 4), [(0, c1), (1, c2)]), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .7; b.inputs['Subsurface Weight'].default_value = .3
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 14; nt.links.new(p, v.inputs['Vector'])
    bump(nt, b, v.outputs['Distance'], 1.0, .1); m.diffuse_color = (*c1, 1); return m

M = dict(
    wall=wall_paint('Pintura blanca', (.78, .77, .74), .9, .15),
    ceil=wall_paint('Techo blanco', (.82, .82, .80), .95),
    render=rough_render('Friso rustico'),
    stained=polished('Cemento pulido verde', [(0, (.02, .08, .07)), (.38, (.04, .11, .06)), (.5, (.1, .12, .04)), (.6, (.2, .14, .035)), (.72, (.08, .11, .04)), (.85, (.03, .1, .08)), (1, (.03, .07, .1))], .28),
    kblue=polished('Cemento pulido azul', [(0, (.02, .08, .12)), (.5, (.04, .16, .21)), (1, (.02, .06, .1))], .5, .25),
    navy=polished('Cemento pulido azul marino', [(0, (.01, .02, .06)), (.5, (.02, .05, .13)), (1, (.01, .03, .08))], .5, .3),
    teal=polished('Cemento pulido gris verdoso', [(0, (.08, .13, .12)), (.5, (.16, .21, .19)), (1, (.1, .15, .13))], .5, .35, .3),
    carpet=ground('Alfombra gris', [(0, (.25, .27, .27)), (.5, (.33, .35, .35)), (1, (.4, .42, .42))], 20, .15),
    terrazzo=terrazzo('Granito'),
    btile=tiles('Ceramica bano', .2, (.75, .82, .86), (.38, .55, .68), (.8, .8, .8)),
    ftile=tiles('Piso bano', .33, (.62, .63, .6), (.58, .59, .56), (.35, .35, .35), .25),
    foliage=foliage('Follaje tragaluz'),
    planks=planks('Tablas de madera'),
    concrete=simple('Viga concreto', (.42, .41, .38), .9),
    brick=brick_wall('Bloque y ladrillo'),
    dirt=ground('Tierra', [(0, (.14, .1, .06)), (.5, (.25, .19, .12)), (1, (.34, .28, .19))], .5, .4),
    gravel=ground('Granzon', [(0, (.12, .12, .11)), (.5, (.3, .29, .27)), (1, (.5, .49, .46))], 30, 1.2),
    grass=ground('Monte', [(0, (.06, .09, .03)), (.5, (.12, .16, .05)), (1, (.22, .22, .1))], 2, .5),
    roof=corrugated('Lamina verde'),
    purlin=simple('Correa metalica', (.25, .06, .03), .5, .6),
    glass=glass('Vidrio'), fglass=glass('Vidrio esmerilado', (.9, .92, .92), .35),
    frame=simple('Aluminio blanco', (.8, .8, .78), .35),
    bars=simple('Reja blanca', (.78, .78, .76), .4),
    door=simple('Puerta madera', (.32, .14, .05), .45),
    white=simple('Blanco lacado', (.8, .8, .78), .3),
    offwhite=simple('Gabinete', (.62, .62, .58), .5),
    stone=simple('Tope claro', (.72, .7, .65), .25),
    timber=simple('Madera clara', (.3, .14, .06), .5),
    dwood=simple('Madera oscura', (.07, .03, .015), .4),
    carved=simple('Madera tallada', (.18, .05, .02), .35),
    steel=simple('Acero inoxidable', (.7, .7, .7), .22, 1.),
    black=simple('Negro', (.015, .015, .015), .4),
    tapestry=striped('Tapiz', (.55, .47, .32), (.2, .1, .05), 18),
    tiger=striped('Cobija tigre', (.12, .1, .35), (.8, .78, .75), 5),
    pink=simple('Almohada rosa', (.6, .2, .4), .8),
    sheet=simple('Sabana', (.75, .72, .66), .85),
    teal_blanket=simple('Cobija turquesa', (.05, .35, .33), .85),
    beige=simple('Cobija beige', (.5, .42, .3), .85),
    curtain=simple('Cortina amarilla', (.62, .36, .04), .8, **{'Sheen Weight': .6}),
    red=simple('Mantel rojo', (.36, .02, .03), .8),
    towel=simple('Toalla azul', (.08, .11, .22), 1.),
    car=simple('Pintura blanca carro', (.82, .82, .8), .25, **{'Coat Weight': 1.}),
    tarp=simple('Forro negro', (.02, .025, .025), .7),
    tint=simple('Vidrio polarizado', (.005, .005, .006), .05, .3),
    rubber=simple('Caucho', (.015, .015, .015), .85),
    rim=simple('Rin', (.5, .5, .52), .3, 1.),
    bark=simple('Corteza', (.12, .09, .06), .95),
    leaf1=leaves('Hojas mango', (.02, .09, .02), (.06, .18, .04)),
    leaf2=leaves('Hojas claras', (.05, .15, .03), (.12, .28, .05)),
    rust=simple('Lamina oxidada', (.25, .1, .04), .8, .3),
    rubble=ground('Escombro', [(0, (.1, .09, .08)), (.5, (.2, .19, .17)), (1, (.3, .29, .26))], 6, 1.),
    led=emission('Luz LED', (1, .88, .72), 40), ledblue=emission('LED azul', (.3, .35, 1), 25),
    screen=emission('Pantalla', (.2, .35, .6), 6), mirror=simple('Espejo', (.9, .9, .9), .02, 1.),
)

# ---------------------------------------------------------------- mesh helpers
def link(ob):
    cur[0].objects.link(ob); return ob

def mesh_ob(name, bm, mat, loc=(0, 0, 0), smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc
    if isinstance(mat, (list, tuple)):
        for m in mat: me.materials.append(m)
    else: me.materials.append(mat)
    return link(ob)

def bevel(ob, w=.01, seg=2):
    md = ob.modifiers.new('Bisel', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    return ob

def pbox(w, h, d, x, y, z, mat, name='caja', rot=0., bev=0.):
    """Caja en coordenadas del plano: ancho w (x), alto h, fondo d (z), centro (x, y, z)."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    ob = mesh_ob(name, bm, mat, (x, -z, y)); ob.rotation_euler[2] = rot
    if bev: bevel(ob, bev)
    return ob

def pcyl(r1, r2, h, x, y, z, mat, name='cilindro', seg=32, axis='Y'):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    ob = mesh_ob(name, bm, mat, (x, -z, y), smooth=True)
    if axis == 'X': ob.rotation_euler[1] = math.pi / 2
    if axis == 'Z': ob.rotation_euler[0] = math.pi / 2
    return ob

def prism(pts, y0, y1, mat, name='prisma'):
    """Extruye un polígono del plano [(x, z), ...] entre las alturas y0 e y1."""
    bm = bmesh.new(); vs = [bm.verts.new((x, -z, y0)) for x, z in pts]
    f = bm.faces.new(vs); bm.normal_update()
    if f.normal.z < 0: f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, y1 - y0), verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_ob(name, bm, mat)

def quad(x0, x1, z0, z1, y, mat, name='plano', down=False):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in [(x0, -z0, y), (x1, -z0, y), (x1, -z1, y), (x0, -z1, y)]]
    f = bm.faces.new(vs if not down else vs[::-1]); bm.normal_update()
    if (f.normal.z < 0) != down: f.normal_flip()
    return mesh_ob(name, bm, mat)

def arc_pts(cx, cz, r, a0, a1, n=48):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cz + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

# ---------------------------------------------------------------- walls
def window(axis, f, c, w, y0, y1, bars=True, frosted=False, side=1):
    hh, mid = y1 - y0, (y0 + y1) / 2
    g = M['fglass'] if frosted else M['glass']
    if axis == 'x':
        pbox(w, hh, .01, c, mid, f, g, 'vidrio')
        put = lambda p, bw, bh, y: pbox(bw, bh, .05, p, y, f, M['frame'], 'marco')
        bar = lambda p: pbox(.016, hh, .016, p, mid, f + side * .09, M['bars'], 'reja')
    else:
        pbox(.01, hh, w, f, mid, c, g, 'vidrio')
        put = lambda p, bw, bh, y: pbox(.05, bh, bw, f, y, p, M['frame'], 'marco')
        bar = lambda p: pbox(.016, hh, .016, f + side * .09, mid, p, M['bars'], 'reja')
    put(c, w, .04, y0); put(c, w, .04, y1); put(c - w / 2, .04, hh, mid); put(c + w / 2, .04, hh, mid); put(c, .03, hh, mid)
    if bars:
        p = c - w / 2 + .11
        while p < c + w / 2 - .05: bar(p); p += .11

def wall(axis, f, a, b, ops=(), h=H, mat=None, t=.15, ext=0, bars=True):
    mat = mat or M['wall']
    def seg(p, q, y0, y1):
        L, hh = q - p, y1 - y0
        if L < .01 or hh < .01: return
        c = (p + q) / 2
        if axis == 'x':
            pbox(L, hh, t, c, y0 + hh / 2, f, mat, 'muro')
            if ext: pbox(L, hh, .012, c, y0 + hh / 2, f + ext * (t / 2 + .006), M['render'], 'friso')
        else:
            pbox(t, hh, L, f, y0 + hh / 2, c, mat, 'muro')
            if ext: pbox(.012, hh, L, f + ext * (t / 2 + .006), y0 + hh / 2, c, M['render'], 'friso')
    s = a
    for op in sorted(ops, key=lambda o: o[1]):
        k, c, w = op[:3]; p, q = c - w / 2, c + w / 2
        seg(s, p, 0, h)
        if k == 'w':
            seg(p, q, 0, op[3]); seg(p, q, op[4], h); window(axis, f, c, w, op[3], op[4], bars, side=ext or 1)
        else:
            seg(p, q, {'g': 2.3, 'd': 2.1}.get(k, 2.1), h)
        s = q
    seg(s, b, 0, h)

def door_leaf(x, z, w, along_x, mat, name='puerta'):
    if along_x: ob = pbox(w, 2.05, .04, x, 1.03, z, mat, name, bev=.004)
    else: ob = pbox(.04, 2.05, w, x, 1.03, z, mat, name, bev=.004)
    return ob

# ================================================================ HOUSE
into('Estructura')
wall('x', R5, A, D, [('w', 10.95, .55, 1.5, 2.1)], ext=-1)
wall('x', R1, A, D, [('w', 2.1, 1.5, 1.0, 2.1), ('w', 5.6, 1.5, 1.0, 2.1)], ext=1)
wall('z', A, R5, R1, [('w', 1.43, 2.15, 1.0, 2.1), ('d', 3.05, .9), ('w', 5.98, 1.5, .9, 2.1)], ext=-1)
wall('z', D, R5, R1, [('d', .92, .75), ('w', 2.85, 1.25, 1.0, 2.1), ('d', 4.72, .8), ('w', 6.87, 1.4, 1.0, 2.1)], ext=1)
wall('z', B, R5, 2.45); pbox(.15, .6, 1.2, B, 2.7, 3.05, M['wall'], 'dintel')
wall('z', B, R4, R1)
wall('x', R4, A, B, [('d', 2.97, .8)]); wall('z', 3.36, R4, 4.45, t=.12)
wall('x', R3, B, D, [('d', 6.62, .85), ('d', 7.72, .8)])
wall('z', C, R5, 1.94); wall('z', C, R3, R1)
wall('x', 1.94, C, D, [('d', 8.0, .8)])
wall('z', 10.40, R5, 1.94)
for x, z in [(A, R5), (B, R5), (C, R5), (D, R5), (A, R4), (D, R4), (B, R3), (C, R3), (D, R3), (A, R1), (B, R1), (C, R1), (D, R1)]:
    pbox(.27, H, .27, x, H / 2, z, M['wall'], 'columna')
pcyl(.27, .27, H, C, H / 2, R4, M['white'], 'columna redonda', 48)
# mampara de ducha
pbox(.01, 2.0, 1.1, 9.46, 1.0, .6, M['glass'], 'mampara'); pbox(.04, .08, 1.2, 9.46, .04, .6, M['white'], 'bordillo')
# puertas
door_leaf(3.34, 4.12, .78, False, M['door']); door_leaf(6.99, 5.745, .83, False, M['door'])
door_leaf(7.36, 5.725, .78, False, M['door']); door_leaf(7.63, 1.46, .78, False, M['door'])
door_leaf(.52, 3.47, .88, True, M['white']); door_leaf(11.88, 5.09, .78, True, M['white']); door_leaf(11.86, .58, .73, True, M['white'])
for (x, z, ax) in [(3.34, 4.4, 'z'), (6.99, 6.0, 'z'), (7.36, 6.0, 'z')]:
    pbox(.1, .025, .025, x + (.05 if ax == 'z' else 0), 1.0, z, M['steel'], 'manilla')

# ---------------------------------------------------------------- floors
into('Pisos')
prism([(A, R5), (D, R5), (D, R1), (A, R1)], -.05, 0, M['stained'], 'piso cemento')
quad(B, C, 0, 1.94, .003, M['kblue'], 'piso cocina')
prism([(.55, .55), (3.5, .55), (3.5, 3.1), (.55, 3.1)], 0, .004, M['terrazzo'], 'borde sala')
prism([(.75, .75), (3.3, .75), (3.3, 2.9), (.75, 2.9)], 0, .006, M['navy'], 'recuadro sala')
quad(C, 10.40, 0, 1.94, .003, M['ftile'], 'piso bano')
quad(A, B, R4, R1, .003, M['navy'], 'piso principal')
quad(B, C, R3, R1, .003, M['carpet'], 'alfombra')
quad(C, D, R3, R1, .003, M['teal'], 'piso dormitorio 3')
KX, KZ = (B + C) / 2, 1.94
prism(arc_pts(KX, KZ, 1.62, 0, math.pi), 0, .004, M['terrazzo'], 'borde cocina')
prism(arc_pts(KX, KZ, 1.44, 0, math.pi), 0, .006, M['kblue'], 'semicirculo cocina')
prism(arc_pts(C, R4, .58, 0, 2 * math.pi, 48)[:-1], 0, .005, M['terrazzo'], 'base columna')

# ---------------------------------------------------------------- ceilings
into('Techos')
SK = dict(x0=7.45, x1=11.15, z0=3.85, z1=5.1)
for x0, x1, z0, z1 in [(A, D, R5, SK['z0']), (A, SK['x0'], SK['z0'], SK['z1']), (SK['x1'], D, SK['z0'], SK['z1']), (A, D, SK['z1'], R1)]:
    pbox(x1 - x0 + (.3 if x1 == D else 0) + (.3 if x0 == A else 0), .15, z1 - z0 + (.3 if z0 == R5 else 0) + (.3 if z1 == R1 else 0),
         (x0 + x1) / 2 + (.15 if x1 == D else 0) - (.15 if x0 == A else 0), H + .075,
         (z0 + z1) / 2 - (.15 if z0 == R5 else 0) + (.15 if z1 == R1 else 0), M['ceil'], 'losa')
cx, cz, w, d = (SK['x0'] + SK['x1']) / 2, (SK['z0'] + SK['z1']) / 2, SK['x1'] - SK['x0'], SK['z1'] - SK['z0']
for args in [(w, .9, .06, cx, H + .45, SK['z0']), (w, .9, .06, cx, H + .45, SK['z1']), (.06, .9, d, SK['x0'], H + .45, cz), (.06, .9, d, SK['x1'], H + .45, cz)]:
    pbox(*args, M['ceil'], 'ducto tragaluz')
for args in [(w + .12, .1, .12, cx, H - .02, SK['z0']), (w + .12, .1, .12, cx, H - .02, SK['z1']), (.12, .1, d, SK['x0'], H - .02, cz), (.12, .1, d, SK['x1'], H - .02, cz)]:
    pbox(*args, M['timber'], 'marco tragaluz')
quad(SK['x0'], SK['x1'], SK['z0'], SK['z1'], H + .86, M['foliage'], 'follaje', down=True)
x = SK['x0'] + .3
while x < SK['x1']:
    pbox(.05, .05, d, x, H + .84, cz, M['black'], 'perfil'); x += .55
pbox(w + .1, .01, d + .1, cx, H + .93, cz, M['glass'], 'vidrio tragaluz')
# techo de tablas con vigas (dormitorio principal)
quad(A, B, R4, R1, H - .01, M['planks'], 'tablas', down=True)
z = R4 + .6
while z < R1:
    pbox(B, .12, .16, B / 2, H - .07, z, M['concrete'], 'viga'); z += .95
# cocina: plafón bajo con frente curvo
quad(B, C, 0, 1.94, 2.6, M['ceil'], 'plafon cocina', down=True)
prism(arc_pts(KX, KZ, 1.62, 0, math.pi), 2.58, 2.6, M['ceil'], 'plafon curvo')
bm = bmesh.new(); n = 48
top = [bm.verts.new((KX + 1.62 * math.cos(math.pi * i / n), -(KZ + 1.62 * math.sin(math.pi * i / n)), H)) for i in range(n + 1)]
bot = [bm.verts.new((v.co.x, v.co.y, 2.58)) for v in top]
for i in range(n): bm.faces.new((top[i], top[i + 1], bot[i + 1], bot[i]))
bm.normal_update(); mesh_ob('banda curva', bm, M['ceil'], smooth=True)
# sala: plafón con ranura de luz diagonal
quad(A, B, R5, R4, 2.85, M['ceil'], 'plafon sala', down=True)
g = pbox(math.hypot(B, R4), .02, .035, B / 2, 2.84, R4 / 2, M['led'], 'ranura LED'); g.rotation_euler[2] = math.atan2(R4, B)
# plafones con luz empotrada
def downlight(x, z, y=H - .005):
    prism(arc_pts(x, z, .06, 0, 2 * math.pi, 16)[:-1], y - .006, y, M['led'], 'ojo de buey')
for x, z in [(5, 2.9), (6.3, 3.3), (8.4, 2.6), (10.3, 2.6), (5.3, 4.4), (8, 6.8), (10, 6.8), (5.6, 7), (8.3, 1), (10.9, 1)]: downlight(x, z)
for x, z in [(4.9, .6), (5.6, 1.2), (6.3, .6), (5.6, 2.6)]: downlight(x, z, 2.595)
for x, z in [(1, 1), (3, 1), (1, 2.7), (3, 2.7)]: downlight(x, z, 2.845)
pcyl(.55, .5, 1.1, 9.9, H + .7, .9, M['black'], 'tanque de agua')

# ================================================================ INTERIOR
into('Mobiliario')
# comedor: mesa de vidrio frente a la puerta de atrás
TX, TZ = 9.45, 4.3
k, tw, td = .14, .95, .5
oct_ = [(-tw + k, -td), (tw - k, -td), (tw, -td + k), (tw, td - k), (tw - k, td), (-tw + k, td), (-tw, td - k), (-tw, -td + k)]
prism([(TX + a, TZ + b) for a, b in oct_], .745, .76, M['glass'], 'mesa vidrio')
for dx in (-.5, .5):
    pbox(.1, .7, .55, TX + dx, .37, TZ, M['carved'], 'pata tallada', bev=.02)
    pbox(.22, .08, .6, TX + dx, .04, TZ, M['carved'], 'base', bev=.015)
pbox(1.1, .1, .1, TX, .3, TZ, M['carved'], 'travesano', bev=.01)

def chair(x, z, ry):
    parts = []
    parts.append(pbox(.46, .08, .46, 0, .47, 0, M['tapestry'], 'asiento', bev=.02))
    for lx, lz in [(-.19, -.19), (.19, -.19), (-.19, .19), (.19, .19)]:
        parts.append(pcyl(.022, .018, .45, lx, .225, lz, M['carved'], 'pata', 10))
    back = pcyl(.19, .19, .04, 0, .93, .2, M['tapestry'], 'respaldo', 32, 'Z'); back.scale = (1, 1.35, 1); parts.append(back)
    bpy.ops.mesh.primitive_torus_add(major_radius=.2, minor_radius=.026, major_segments=40, minor_segments=8, location=(0, -.2, .93), rotation=(math.pi / 2, 0, 0))
    ring = bpy.context.active_object; ring.scale = (1, 1.35, 1); ring.data.materials.append(M['carved'])
    for c in ring.users_collection: c.objects.unlink(ring)
    link(ring); parts.append(ring)
    for px in (-.19, .19): parts.append(pcyl(.022, .022, .5, px, .72, .21, M['carved'], 'poste', 10))
    empty = bpy.data.objects.new('silla', None); link(empty); empty.location = (x, -z, 0); empty.rotation_euler[2] = ry
    for p in parts: p.parent = empty
    return empty
for (x, z, r) in [(TX - .55, TZ - .62, math.pi), (TX + .55, TZ - .62, math.pi), (TX - .55, TZ + .6, 0), (TX + .55, TZ + .6, 0), (TX - 1.3, TZ, -math.pi / 2), (TX + 1.3, TZ, math.pi / 2)]:
    chair(x, z, r)
# lámpara en X
for r, dy in ((.42, 0), (-.42, .06)):
    b_ = pbox(1.9, .03, .03, 8.9, 2.3 + dy, 2.9, M['black'], 'lampara'); b_.rotation_euler[2] = r
    l_ = pbox(1.8, .005, .018, 8.9, 2.283 + dy, 2.9, M['led'], 'lampara luz'); l_.rotation_euler[2] = r
for dx in (-.75, .75): pcyl(.003, .003, .7, 8.9 + dx * .9, 2.66, 2.9 + dx * .4, M['black'], 'guaya', 6)
pbox(.5, .04, .08, 8.9, 3.0, 2.9, M['black'], 'florón')
# lavadora y cajas de zapatos junto al lavadero
pbox(.62, .92, .62, 10.9, .46, 2.35, M['white'], 'lavadora', bev=.03)
for y, h, c in [(.12, .24, (.1, .2, .5)), (.37, .25, (.05, .3, .12)), (.6, .2, (.3, .18, .1)), (.8, .18, (.03, .03, .03))]:
    pbox(.4, h, .3, 10.2, y, 2.2, simple('Caja', c, .7), 'caja zapatos', bev=.005)
for y in (1.1, 1.55): pbox(.22, .03, .8, 4.2, y, 4.5, M['white'], 'repisa')

# cocina
pbox(.75, 1.78, .92, 4.52, .89, 1.25, M['steel'], 'nevera', bev=.02)
pbox(.005, 1.6, .005, 4.9, .95, 1.25, M['black'], 'junta nevera')
for dz in (-.06, .06): pcyl(.012, .012, .7, 4.93, 1.15, 1.25 + dz, M['steel'], 'agarradera', 8)
pbox(.01, .3, .2, 4.9, 1.15, 1.5, M['black'], 'dispensador')
pbox(2.0, .88, .6, 6.0, .44, .375, M['offwhite'], 'gabinete bajo', bev=.005); pbox(2.04, .04, .64, 6.0, .9, .375, M['stone'], 'tope')
pbox(.6, .88, 1.1, 6.72, .44, 1.2, M['offwhite'], 'peninsula', bev=.005); pbox(.64, .04, 1.14, 6.72, .9, 1.2, M['timber'], 'tope madera')
for y in (.12, .4, .68): pbox(.62, .08, .03, 6.72, y, 1.77, M['timber'], 'banda madera')
pbox(.5, .01, .6, 6.72, .925, 1.35, M['black'], 'tope cocina')
for x, z in [(6.57, 1.2), (6.87, 1.2), (6.57, 1.5), (6.87, 1.5)]: pcyl(.06, .06, .02, x, .94, z, M['black'], 'hornilla', 16)
pcyl(.14, .14, .18, 6.57, 1.03, 1.2, M['steel'], 'olla')
pbox(.6, .02, .4, 5.3, .925, .37, M['steel'], 'fregadero')
pbox(1.4, .6, .35, 5.55, 1.95, .25, M['dwood'], 'gabinete alto', bev=.005)
pbox(1.36, .02, .02, 5.55, 1.64, .42, M['led'], 'luz bajo gabinete')
pbox(2.0, .6, .01, 6.0, 1.25, .08, simple('Salpicadero', (.7, .72, .7), .15), 'salpicadero')
hood = pcyl(.12, .45, .3, 6.72, 1.72, 1.35, M['steel'], 'campana', 4); hood.rotation_euler[2] = math.pi / 4
pbox(.2, .75, .2, 6.72, 2.2, 1.35, M['steel'], 'chimenea')
for x, h, c in [(5.0, .2, (.8, .78, .7)), (5.2, .14, (.3, .15, .06)), (6.3, .18, (.8, .8, .8))]:
    pcyl(.05, .05, h, x, .92 + h / 2, .3, simple('Frasco', c, .2), 'frasco', 16)

# baño
pbox(.01, 2.1, 1.79, 7.18, 1.05, .97, M['btile'], 'ceramica'); pbox(.01, 2.1, 1.79, 10.32, 1.05, .97, M['btile'], 'ceramica')
pbox(3.14, 2.1, .01, 8.75, 1.05, .08, M['btile'], 'ceramica')
pcyl(.17, .2, .4, 8.8, .2, .5, M['white'], 'poceta'); pbox(.38, .05, .45, 8.8, .42, .48, M['white'], 'tapa', bev=.02)
pbox(.38, .38, .18, 8.8, .6, .2, M['white'], 'tanque', bev=.02)
pbox(.5, .15, .4, 7.55, .85, .3, M['white'], 'lavamanos', bev=.03); pcyl(.05, .05, .7, 7.55, .4, .3, M['white'], 'pedestal')
pcyl(.08, .08, .02, 10.1, 2.05, .5, M['steel'], 'regadera')

# sala
pbox(2.2, .3, .42, 2.0, .55, .3, M['white'], 'mueble TV', bev=.005); pbox(2.2, .06, .45, 2.0, .74, .31, M['white'], 'tope TV')
for x in (1.45, 2.55): pbox(1.0, .18, .02, x, .52, .52, simple('Gris', (.35, .35, .33), .5), 'gaveta')
lean = pbox(.05, 2.1, .9, 3.86, 1.04, 1.1, M['door'], 'puerta recostada', bev=.004); lean.rotation_euler[1] = -.08
pcyl(.5, .55, .74, 3.1, .37, 1.25, M['red'], 'mesa redonda'); prism(arc_pts(3.1, 1.25, .58, 0, 2 * math.pi, 8)[:-1], .745, .76, M['glass'], 'vidrio mesa')

# dormitorios
def bed(x, z, w, d, rot, cover, pill, h=.45):
    e = bpy.data.objects.new('cama', None); link(e); e.location = (x, -z, 0); e.rotation_euler[2] = rot
    parts = [pbox(w, h - .2, d, 0, (h - .2) / 2, 0, simple('Base cama', (.2, .15, .1), .7), 'base', bev=.01),
             pbox(w - .04, .2, d - .04, 0, h - .1, 0, M['sheet'], 'colchon', bev=.05),
             pbox(w + .04, .04, d * .72, 0, h + .01, d * .14, cover, 'cobija', bev=.02)]
    for px in ([-w / 4, w / 4] if w > 1.2 else [0]):
        parts.append(pbox(w / 2 - .1 if w > 1.2 else w - .2, .13, .35, px, h + .07, -d / 2 + .25, pill, 'almohada', bev=.05))
    for p in parts: p.parent = e
def ac(x, z, rot):
    e = bpy.data.objects.new('aire', None); link(e); e.location = (x, -z, 2.45); e.rotation_euler[2] = rot
    for p in [pbox(.9, .3, .22, 0, 0, 0, M['white'], 'aire', bev=.03), pbox(.8, .03, .01, 0, -.09, -.111, M['black'], 'rejilla')]: p.parent = e
bed(2.1, 7.4, 1.4, 1.95, math.pi, M['tiger'], M['pink'])
pbox(.6, 2.2, 1.5, 3.67, 1.1, 5.6, M['dwood'], 'escaparate', bev=.01); pbox(.01, 2.0, .01, 3.36, 1.1, 5.6, M['black'], 'junta')
bm = bmesh.new(); nx = 60
for j in range(2):
    for i in range(nx + 1):
        zz = 5.98 - 1.25 + 2.5 * i / nx
        bm.verts.new((.16 + .035 * math.sin(zz * 22), -zz, .85 + 1.6 * j))
bm.verts.ensure_lookup_table()
for i in range(nx): bm.faces.new((bm.verts[i], bm.verts[i + 1], bm.verts[nx + 2 + i], bm.verts[nx + 1 + i]))
cur_ob = mesh_ob('cortina', bm, M['curtain'], smooth=True); cur_ob.modifiers.new('Grosor', 'SOLIDIFY').thickness = .004
pbox(.03, .03, 2.7, .14, 2.48, 5.98, M['black'], 'barra cortina')
pcyl(.1, .1, .01, 2, 2.9, 6.2, M['led'], 'bombillo'); ac(3.35, R1 - .19, 0)
bed(5.3, 7.45, 1.4, 1.9, math.pi, M['teal_blanket'], M['red'], .25)
pbox(2.8, .02, .02, 5.575, 2.95, R1 - .09, M['ledblue'], 'tira LED azul'); ac(5.575, R3 + .19, math.pi)
pbox(.95, 2.3, .6, 8.65, 1.15, 5.63, M['white'], 'closet', bev=.005); pbox(.18, 1.9, .01, 8.4, 1.1, 5.935, M['fglass'], 'puerta esmerilada')
pbox(.08, 2.3, .45, 9.18, 1.15, 5.55, M['white'], 'lateral')
for y in (.55, 1.05, 1.55): pbox(.5, .03, .4, 9.45, y, 5.53, M['white'], 'repisa iluminada')
pbox(.5, 1.6, .02, 9.45, 1.2, 5.34, emission('Fondo iluminado', (1, .85, .6), 3), 'fondo repisas')
pbox(1.6, .04, .6, 10.5, .76, 5.63, M['white'], 'escritorio'); pbox(.6, .35, .03, 10.4, 1.05, 5.45, M['screen'], 'monitor')
pbox(.25, .45, .45, 11.0, .99, 5.6, M['black'], 'computadora')
y = 1.13
while y < 2.08: pbox(.06, .005, 1.35, 11.3, y, 6.87, M['frame'], 'persiana'); y += .04
bed(9.6, 7.7, 1.3, 1.9, -math.pi / 2, M['beige'], simple('Almohada verde', (.5, .55, .15), .8), .22)
ac(7.26, 7.4, -math.pi / 2)
pbox(.5, 1.5, .03, 8.1, .8, R1 - .12, M['mirror'], 'espejo')

# ================================================================ GARAGE (carros a lo largo)
into('Garaje')
g0, g1, gz0, gz1 = GAR['x0'], GAR['x1'], GAR['z0'], GAR['z1']
quad(g0, g1, gz0, gz1, .004, M['gravel'], 'piso garaje')
wall('x', gz0, g0, g1, [('g', -5.3, 3.0)], h=2.8, mat=M['render'], t=.2)   # frente con portón
wall('z', g0, gz0, gz1, [], h=2.8, mat=M['render'], t=.2)
wall('x', gz1, g0, g1, [('d', -1.0, .9)], h=2.8, mat=M['render'], t=.2)
# portón de reja blanca con diseño de triángulos
gx = -5.3
xx = gx - 1.45
while xx <= gx + 1.46: pbox(.03, 2.25, .03, xx, 1.13, gz0, M['bars'], 'barrote'); xx += .2
for y in (.05, .75, 1.5, 2.25): pbox(3.0, .04, .04, gx, y, gz0, M['bars'], 'travesano')
i = 0; xx = gx - 1.4
while xx < gx + 1.4:
    for (y0, y1) in ((.05, .75), (.75, 1.5), (1.5, 2.25)):
        dgl = pbox(.02, math.hypot(.4, .7), .02, xx + .2, (y0 + y1) / 2, gz0, M['bars'], 'diagonal')
        dgl.rotation_euler[1] = math.atan2(.4, y1 - y0) * (1 if i % 2 else -1)
    xx += .4; i += 1
# techo de lámina verde
r = quad(g0, g1, gz0, gz1, 2.95, M['roof'], 'techo garaje', down=True); r.rotation_euler[0] = .03
x = g0 + .5
while x < g1: pbox(.08, .1, gz1 - gz0, x, 2.86, (gz0 + gz1) / 2, M['purlin'], 'correa'); x += 1.3
pbox(.06, .03, 1.6, -3.5, 2.7, 3.2, M['led'], 'tubo fluorescente')

def sedan(x, z, heading, body, covered=False):
    """Sedán; heading = hacia dónde apunta el frente en el plano (radianes, 0 = -z/norte)."""
    e = bpy.data.objects.new('carro', None); link(e); e.location = (x, -z, 0); e.rotation_euler[2] = heading
    prof = [(.05, .35), (0, .55), (.06, .76), (.9, .87), (1.55, .95), (2.35, 1.4), (3.45, 1.42), (4.05, 1.02), (4.52, .95), (4.6, .7), (4.55, .35)]
    def side_prism(pts, width, mat, name):
        bm = bmesh.new()
        a = [bm.verts.new((-width / 2, 2.3 - px, py)) for px, py in pts]
        bm.faces.new(a); ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
        bmesh.ops.translate(bm, vec=(width, 0, 0), verts=[v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ob = mesh_ob(name, bm, mat); ob.parent = e; return ob
    bodyob = side_prism(prof, 1.76, body, 'carroceria'); bevel(bodyob, .06, 4)
    if not covered:
        side_prism([(1.64, .99), (2.37, 1.36), (3.42, 1.38), (3.98, 1.04)], 1.8, M['tint'], 'ventanas')
        ws = pbox(1.5, .01, .93, 0, 1.19, 0, M['tint'], 'parabrisas'); ws.location = (0, 2.3 - 1.95, 1.19); ws.rotation_euler[0] = -math.atan2(.45, .8); ws.parent = e
        rw = pbox(1.4, .01, .72, 0, 1.23, 0, M['tint'], 'vidrio trasero'); rw.location = (0, 2.3 - 3.75, 1.23); rw.rotation_euler[0] = math.atan2(.4, .6); rw.parent = e
        for sx in (-.6, .6):
            hl = pbox(.35, .07, .04, 0, 0, 0, emission('Faro', (1, 1, 1), 2), 'faro'); hl.location = (sx, 2.33, .72); hl.parent = e
            tl = pbox(.35, .08, .04, 0, 0, 0, emission('Stop', (.6, 0, 0), 1), 'stop'); tl.location = (sx, -2.33, .8); tl.parent = e
    for wx, wy in [(-.82, 1.45), (.82, 1.45), (-.82, -1.25), (.82, -1.25)]:
        t = pcyl(.33, .33, .24, 0, 0, 0, M['rubber'], 'caucho', 28, 'X'); t.location = (wx, wy, .33); t.parent = e
        if not covered:
            rr = pcyl(.22, .22, .02, 0, 0, 0, M['rim'], 'rin', 20, 'X'); rr.location = (wx + (.12 if wx > 0 else -.12), wy, .33); rr.parent = e
    return e
sedan(-1.9, 3.3, math.pi, M['car'])          # blanco, pegado a la casa, frente hacia adentro
sedan(-4.8, 3.3, 0, M['tarp'], True)         # forrado, frente hacia el portón

# ================================================================ EXTERIOR
into('Exterior')
quad(-70, 70, -60, 80, -.03, M['grass'], 'terreno vecino')
prism([(LOT_X0, 0), (LOT_X1, 0), (LOT_X1, zS(LOT_X1)), (LOT_X0, zS(LOT_X0))], -.05, -.005, M['dirt'], 'patio de tierra')
quad(-16, LOT_X0, -8, 26, -.02, ground('Calle', [(0, (.1, .1, .09)), (.5, (.2, .19, .17)), (1, (.3, .28, .25))], 3, .3), 'calle')
def lot_wall(x0, z0, x1, z1, h=2.4):
    L = math.hypot(x1 - x0, z1 - z0)
    ob = pbox(L, h, .2, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, M['brick'], 'muro lindero'); ob.rotation_euler[2] = math.atan2(z1 - z0, x1 - x0)
lot_wall(D + .15, 0, LOT_X1, 0); lot_wall(LOT_X1, 0, LOT_X1, zS(LOT_X1)); lot_wall(LOT_X0, zS(LOT_X0), LOT_X1, zS(LOT_X1)); lot_wall(LOT_X0, GAR['z1'], LOT_X0, zS(LOT_X0))

def tree(x, z, s, mats):
    tr = pcyl(.14 * s, .26 * s, 2.6 * s, x, 1.3 * s, z, M['bark'], 'tronco', 12)
    for i in range(9):
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=(.8 + random.random() * .6) * s)
        for v in bm.verts:
            f = 1 + (random.random() - .5) * .35; v.co.x *= f; v.co.y *= f; v.co.z *= f * .8
        ob = mesh_ob('copa', bm, mats[i % len(mats)], (x + random.uniform(-1.1, 1.1) * s, -(z + random.uniform(-1.1, 1.1) * s), (2.7 + random.random() * 1.3) * s), smooth=True)
        d = ob.modifiers.new('Hojas', 'DISPLACE'); tx = bpy.data.textures.new('ruido hojas', 'CLOUDS'); tx.noise_scale = .25 * s; d.texture = tx; d.strength = .35 * s
for args in [(17.6, 9.5, 1.8), (14.5, 14, 1.6), (4, 17.5, 1.7), (-3.5, 16.5, 1.6), (18.2, 2.4, 1.2), (10, 14.8, 1.3)]:
    tree(*args, [M['leaf1'], M['leaf2']])
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.3)
for v in bm.verts: v.co.z *= .4; v.co *= 1 + (random.random() - .5) * .3
mesh_ob('escombros', bm, M['rubble'], (15.6, -6.2, .1))
pbox(2, 2.1, 3, 18.7, 1.05, 5.6, M['render'], 'deposito'); pbox(2.3, .05, 3.3, 18.6, 2.14, 5.6, M['rust'], 'techo deposito')
zz = 4.4
while zz < 6.9: pbox(.02, 1.2, .02, 17.68, 1.1, zz, M['rust'], 'reja deposito'); zz += .12
pcyl(.3, .3, .9, 13, .45, 14.6, M['rust'], 'tambor'); pcyl(.38, .34, .6, 13, 1.2, 14.6, M['black'], 'pipote')
lad = bpy.data.objects.new('escalera', None); link(lad); lad.location = (11.75, -1.7, 0); lad.rotation_euler[1] = -.18
for zz in (-.25, .25): pbox(.04, 3, .04, 0, 1.5, zz, M['steel'], 'larguero').parent = lad
yy = .3
while yy < 3: pbox(.05, .03, .5, 0, yy, 0, M['steel'], 'peldano').parent = lad; yy += .3

# ================================================================ LIGHTING
into('Luces')
world = bpy.data.worlds.new('Cielo'); sc.world = world; world.use_nodes = True
wn = world.node_tree; wn.nodes.clear()
sky = wn.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'MULTIPLE_SCATTERING'
SUN_EL, SUN_ROT = math.radians(52), math.radians(215)
sky.sun_elevation = SUN_EL; sky.sun_rotation = SUN_ROT; sky.sun_disc = False; sky.air_density = 1.2; sky.aerosol_density = 1.5
bg = wn.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = .35
wo = wn.nodes.new('ShaderNodeOutputWorld'); wn.links.new(sky.outputs[0], bg.inputs[0]); wn.links.new(bg.outputs[0], wo.inputs[0])
sun_data = bpy.data.lights.new('Sol', 'SUN'); sun_data.energy = 3.4; sun_data.angle = math.radians(.8); sun_data.color = (1, .95, .88)
sun = bpy.data.objects.new('Sol', sun_data); link(sun)
SUN_DIR = Vector((-.45, -.55, .9)).normalized()  # hacia el sol: suroeste, alto
sun.rotation_euler = (-SUN_DIR).to_track_quat('-Z', 'Y').to_euler()
# luces interiores cálidas (bajo cada ojo de buey principal)
for x, z, pw in [(5, 2.9, 60), (8.4, 2.6, 60), (10.3, 2.6, 60), (5.6, 1.0, 50), (2, 1.8, 80), (1.2, 5.0, 90), (2.8, 7.2, 90), (5.6, 7, 80), (9.2, 7, 90), (8.3, 1, 45), (-3.5, 2.0, 160), (-3.5, 5.0, 160), (5.3, 4.4, 45)]:
    ld = bpy.data.lights.new('Luz', 'AREA'); ld.shape = 'DISK'; ld.size = .25; ld.energy = pw; ld.color = (1, .86, .7)
    lo = bpy.data.objects.new('Luz', ld); link(lo); lo.location = (x, -z, (2.55 if (4 < x < 7.1 and z < 2) else 2.8 if x < 4.05 and z < 3.65 else H - .03))
ld = bpy.data.lights.new('LED azul', 'AREA'); ld.size = 1; ld.energy = 15; ld.color = (.35, .4, 1)
lo = bpy.data.objects.new('LED azul', ld); link(lo); lo.location = (5.575, -8.2, 2.9)

# ================================================================ RENDER SETTINGS
sc.render.engine = 'CYCLES'; cy = sc.cycles
cy.device = 'CPU'; cy.samples = 96; cy.use_adaptive_sampling = True; cy.adaptive_threshold = .03
cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 8; cy.diffuse_bounces = 4; cy.glossy_bounces = 3; cy.transmission_bounces = 6; cy.transparent_max_bounces = 8
cy.sample_clamp_indirect = 6; cy.caustics_reflective = False; cy.caustics_refractive = False
cy.use_light_tree = True
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88

# ================================================================ CAMERAS
into('Camaras')
TOUR = {  # id: (nombre, x, z, altura)
    'comedor': ('Comedor', 10.4, 3.2, 1.6), 'cocina': ('Cocina', 5.6, 3.3, 1.6), 'sala': ('Sala', 2.0, 2.0, 1.6),
    'principal': ('Dormitorio principal', 1.9, 5.2, 1.6), 'dorm2': ('Dormitorio 2', 5.6, 6.2, 1.6),
    'dorm3': ('Dormitorio 3', 9.0, 6.4, 1.6), 'bano': ('Baño', 8.4, 1.25, 1.6), 'garaje': ('Garaje', -3.35, 5.95, 1.6),
    'patio': ('Patio', 15.2, 8.5, 1.6),
}
def pano_cam(key):
    name, x, z, h = TOUR[key]
    cd = bpy.data.cameras.new('pano ' + key); cd.type = 'PANO'; cd.panorama_type = 'EQUIRECTANGULAR'; cd.clip_start = .05
    co = bpy.data.objects.new('pano ' + key, cd); link(co); co.location = (x, -z, h); co.rotation_euler = (math.pi / 2, 0, 0)
    return co

def render_panos(keys, w=4096, samples=96):
    sc.render.resolution_x, sc.render.resolution_y = w, w // 2; sc.render.resolution_percentage = 100
    cy.samples = samples
    os.makedirs(os.path.join(OUT, 'panos'), exist_ok=True)
    for k in keys:
        sc.camera = pano_cam(k); sc.render.filepath = os.path.join(OUT, 'panos', k + '.jpg')
        print('RENDER', k, flush=True); bpy.ops.render.render(write_still=True)

def view_cam(name, loc, target, lens=18):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.clip_start = .05
    co = bpy.data.objects.new(name, cd); link(co); co.location = loc
    d = Vector(target) - Vector(loc); co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return co

def render_views(w=1920, h=1080, samples=128):
    sc.render.resolution_x, sc.render.resolution_y = w, h; cy.samples = samples
    os.makedirs(os.path.join(OUT, 'vistas'), exist_ok=True)
    views = {
        'aerea': ((24, -26, 22), (5.2, -5.5, 0), 26, True),
        'comedor': ((11.0, -3.0, 1.5), (5.0, -1.8, 1.2), 14, False),
        'patio': ((17.5, -12.5, 1.7), (9, -3, 1.4), 18, False),
        'garaje': ((-3.4, -6.2, 1.7), (-3.4, 0, 1.2), 14, False),
    }
    for k, (loc, tgt, lens, hide_roof) in views.items():
        for c in (COL['Techos'],): c.hide_render = hide_roof
        for ob in COL['Garaje'].objects:
            if ob.name.startswith('techo garaje') or ob.name.startswith('correa'): ob.hide_render = hide_roof
        sc.camera = view_cam('vista ' + k, loc, tgt, lens); sc.render.filepath = os.path.join(OUT, 'vistas', k + '.jpg')
        print('RENDER', k, flush=True); bpy.ops.render.render(write_still=True)
    COL['Techos'].hide_render = False
    for ob in COL['Garaje'].objects: ob.hide_render = False

sc.camera = view_cam('Recorrido', (10.4, -3.2, 1.6), (5, -2, 1.4), 20)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'casa.blend'), compress=True)
print('SAVED', flush=True)

if '--render' in ARGS:
    what = ARGS[ARGS.index('--render') + 1]
    keys = ARGS[ARGS.index('--render') + 2:] or list(TOUR)
    if what == 'panos':
        w = int(os.environ.get('PANO_W', 4096)); s = int(os.environ.get('SAMPLES', 96))
        render_panos(keys, w, s)
    elif what == 'views':
        render_views(samples=int(os.environ.get('SAMPLES', 128)))
