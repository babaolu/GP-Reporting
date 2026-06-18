import crypto from 'crypto';

/**
 * Generates a secure random 16-character alphanumeric password
 * containing at least one uppercase letter, one lowercase letter, one number, and one special character.
 */
export function generateTemporaryPassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=';
  
  // Guarantee at least one of each class
  let password = '';
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  const allChars = lowercase + uppercase + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => crypto.randomBytes(1)[0] - 128).join('');
}
