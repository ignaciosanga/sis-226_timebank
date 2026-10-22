import { PasswordService } from './password.service';

describe('PasswordService con Argon2id real', () => {
  const passwords = new PasswordService();

  it('genera hash Argon2id con sal y verifica la contrasena', async () => {
    const first = await passwords.hash('clave-segura-de-prueba');
    const second = await passwords.hash('clave-segura-de-prueba');
    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
    expect(await passwords.verify(first, 'clave-segura-de-prueba')).toBe(true);
    expect(await passwords.verify(first, 'incorrecta')).toBe(false);
  });

  it('rechaza hashes malformados y formatos no aprobados', async () => {
    expect(await passwords.verify('$argon2id$invalid', 'test')).toBe(false);
    expect(await passwords.verify('texto-plano', 'texto-plano')).toBe(false);
  });

  it('consume una verificacion real cuando el usuario no existe', async () => {
    const verify = jest.spyOn(passwords, 'verify');
    expect(await passwords.verifyOrDummy(undefined, 'incorrecta')).toBe(false);
    expect(verify).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'incorrecta',
    );
    verify.mockRestore();
  });
});
