export const AVATAR_STYLES = ['bolita', 'cuadradito', 'burbuja', 'gota']
export const AVATAR_COLORS = ['azul', 'amarillo', 'verde', 'coral', 'lila', 'nube']
export const AVATAR_ACCESSORIES = ['ninguno', 'chispa', 'birrete', 'audifonos']

export const STYLE_OPTIONS = [['bolita', 'Bolita'], ['cuadradito', 'Cuadradito'], ['burbuja', 'Burbuja'], ['gota', 'Gota']]
export const COLOR_OPTIONS = [['azul', 'Azul'], ['amarillo', 'Amarillo'], ['verde', 'Verde'], ['coral', 'Coral'], ['lila', 'Lila'], ['nube', 'Nube']]
export const ACCESSORY_OPTIONS = [['ninguno', 'Nada'], ['chispa', 'Chispa'], ['birrete', 'Birrete'], ['audifonos', 'Audífonos']]

const TONES = { azul: '#7fb8e6', amarillo: '#ffd659', verde: '#8fdcb8', coral: '#ffab9e', lila: '#c5b4f2', nube: '#d3dce4' }

export const DEFAULT_AVATAR = Object.freeze({ estilo: 'bolita', color: 'azul', accesorio: 'chispa', nombre: 'Nexo' })

export const pick = (options, value, fallback = options[0]) => (options.includes(value) ? value : fallback)

export const avatarTone = (color) => TONES[color] ?? TONES.azul

export function normalizeAvatar(avatar) {
  const nombre = typeof avatar?.nombre === 'string' && avatar.nombre.trim() ? avatar.nombre.trim() : DEFAULT_AVATAR.nombre
  return {
    estilo: pick(AVATAR_STYLES, avatar?.estilo),
    color: pick(AVATAR_COLORS, avatar?.color),
    accesorio: pick(AVATAR_ACCESSORIES, avatar?.accesorio, DEFAULT_AVATAR.accesorio),
    nombre,
  }
}
