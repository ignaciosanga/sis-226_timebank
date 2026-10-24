export const REGISTRATION_POLICY = Symbol('REGISTRATION_POLICY');

export interface RegistrationPolicy {
  // Solo desarrollo/pruebas v0.2: crear perfil sin cuentas ni politica de creditos.
  profileOnly?: boolean;
  // Decimal como texto para no introducir redondeo de creditos; null bloquea registro.
  initialCredits: string | null;
}
