export const REGISTRATION_POLICY = Symbol('REGISTRATION_POLICY');

export interface RegistrationPolicy {
  // Compatibilidad de tests históricos; ya no permite omitir la verificación.
  profileOnly?: boolean;
  // Política interna como texto; actualmente entero. null bloquea nuevas altas/activaciones.
  initialCredits: string | null;
}
