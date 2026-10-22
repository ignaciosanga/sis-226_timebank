export const REGISTRATION_POLICY = Symbol('REGISTRATION_POLICY');

export interface RegistrationPolicy {
  // Decimal como texto para no introducir redondeo de creditos; null bloquea registro.
  initialCredits: string | null;
}
