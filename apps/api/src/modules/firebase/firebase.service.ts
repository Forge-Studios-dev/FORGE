import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private messaging: Messaging | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initAdmin();
  }

  private initAdmin() {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.log('Firebase Admin SDK not configured (missing FIREBASE_* env)');
      return;
    }
    try {
      if (getApps().length === 0) {
        this.app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        this.app = getApps()[0]!;
      }
      this.messaging = getMessaging(this.app);
      this.logger.log('Firebase Admin SDK initialized');
    } catch (e) {
      this.logger.warn(`Firebase Admin init failed: ${(e as Error).message}`);
    }
  }

  isFcmEnabled(): boolean {
    return (
      this.configService.get<boolean>('firebase.fcmEnabled') === true && this.messaging !== null
    );
  }

  isAppCheckEnabled(): boolean {
    return (
      this.configService.get<boolean>('firebase.appCheckEnabled') === true && this.app !== null
    );
  }

  getMessaging(): Messaging | null {
    return this.messaging;
  }

  async verifyAppCheckToken(token: string): Promise<boolean> {
    if (!this.isAppCheckEnabled() || !this.app) return true;
    try {
      await getAppCheck(this.app).verifyToken(token);
      return true;
    } catch {
      return false;
    }
  }
}
