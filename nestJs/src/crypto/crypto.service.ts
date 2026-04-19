import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly isProduction: boolean;

  constructor(private configService: ConfigService) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const secretKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!secretKey) {
      if (this.isProduction) {
        throw new Error('ENCRYPTION_KEY is required in production.');
      }

      this.logger.warn(
        'ENCRYPTION_KEY variable is missing! Using a default dev key. THIS IS INSECURE FOR PRODUCTION.',
      );
      // Fallback 32-byte key for local development so it doesn't crash on start
      this.key = crypto.scryptSync('default_dev_secret_phrase', 'salt', 32);
    } else {
      // Assuming ENCRYPTION_KEY is a 64-char hex string (32 bytes)
      if (secretKey.length === 64) {
        this.key = Buffer.from(secretKey, 'hex');
      } else {
        // As a fallback if the key is a random string, create a 32 byte hash
        this.key = crypto.createHash('sha256').update(secretKey).digest();
      }
    }
  }

  /**
   * Encrypts a string into the prefix-based format:
   * [ENC_v1]:[IV_Base64]:[AuthTag_Base64]:[Ciphertext_Base64]
   */
  encrypt(text: string | null | undefined): string | null {
    if (!text) return text as any;

    try {
      const iv = crypto.randomBytes(12); // GCM standard
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag().toString('base64');

      return `[ENC_v1]:${iv.toString('base64')}:${authTag}:${encrypted}`;
    } catch (error) {
      this.logger.error('Failed to encrypt text', error);
      throw new Error('Failed to encrypt protected data.');
    }
  }

  /**
   * Decrypts a prefix-based encrypted string.
   * If it doesn't have the prefix, returns the raw text.
   */
  decrypt(encryptedText: string | null | undefined): string | null {
    if (!encryptedText) return encryptedText as any;

    if (!encryptedText.startsWith('[ENC_v1]:')) {
      return encryptedText; // Not encrypted or legacy data
    }

    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encryption format');
      }

      const [, ivBase64, authTagBase64, cipherTextBase64] = parts;

      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(cipherTextBase64, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt text', error);
      return '[Erro ao descriptografar mensagem]';
    }
  }
}
