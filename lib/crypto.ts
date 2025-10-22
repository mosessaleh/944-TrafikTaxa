import * as bcrypt from 'bcryptjs';

export async function hashPassword(password: string){
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(plain: string, hashed: string){
  return bcrypt.compare(plain, hashed);
}
