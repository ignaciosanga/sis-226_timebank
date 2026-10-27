export const emptyAccountForm = () => ({ nombre: '', apellido: '', correo: '', password: '', confirmPassword: '', idCarrera: '', semestre: '' })

export function validateAccount(input, careers, { confirm = false } = {}) {
  const errors = {}
  for (const field of ['nombre', 'apellido']) {
    const value = String(input[field] ?? '').trim()
    if (!value) errors[field] = field === 'nombre' ? 'Escribe tu nombre.' : 'Escribe tu apellido.'
    else if (value.length > 100) errors[field] = 'Utiliza hasta 100 caracteres.'
  }
  const email = String(input.correo ?? '').trim()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.correo = 'Escribe un correo electrónico válido.'
  else if (email.split('@')[1].toLowerCase() !== 'ucb.edu.bo') errors.correo = 'Utiliza tu correo institucional terminado en @ucb.edu.bo.'
  if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) errors.password = 'La contraseña debe tener entre 12 y 128 caracteres.'
  if (confirm && input.confirmPassword !== input.password) errors.confirmPassword = 'Las contraseñas deben coincidir.'
  if (!careers.some((career) => career.id_carrera === input.idCarrera && career.estado === 'activo')) errors.idCarrera = 'Selecciona una carrera activa.'
  const semester = Number(input.semestre)
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) errors.semestre = 'Selecciona un semestre entre 1 y 12.'
  return errors
}

// Exact RegisterDto body; confirmation and roles never leave the form.
export function toRegisterPayload(input) {
  return {
    nombre: input.nombre.trim(), apellido: input.apellido.trim(), correo: input.correo.trim().toLowerCase(),
    password: input.password, idCarrera: input.idCarrera, semestre: Number(input.semestre),
  }
}
