import { SkillLevel } from '../user-skills/user-skill.types';

/** Siempre texto decimal canónico, nunca Prisma.Decimal en el estado clonado. */
export interface TutoringOffer {
  id_oferta: string;
  id_tutor: string;
  id_habilidad: string;
  id_disponibilidad: string;
  id_banner: string | null;
  nivel: SkillLevel;
  titulo: string;
  descripcion: string;
  costo_creditos: string;
  estado: 'Activa' | 'Finalizada';
  created_at: Date;
}
