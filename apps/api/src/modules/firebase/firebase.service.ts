import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

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
    const jsonRaw = this.configService.get<string>('firebase.serviceAccountJson');
    const useAdc = this.configService.get<boolean>('firebase.useApplicationDefault');

    if (jsonRaw?.trim()) {
      if (this.initFromServiceAccountJson(jsonRaw, projectId)) return;
    }

    if (useAdc || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      if (this.initFromApplicationDefault(projectId)) return;
    }

    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.log('Firebase Admin SDK not configured (missing FIREBASE_* env)');
      return;
    }
    this.initWithCert(projectId, clientEmail, privateKey);
  }

  private initFromServiceAccountJson(jsonRaw: string, fallbackProjectId?: string): boolean {
    try {
      const j = JSON.parse(jsonRaw) as ServiceAccountJson;
      const projectId = j.project_id || fallbackProjectId;
      const clientEmail = j.client_email;
      const privateKey = j.private_key;
      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON missing project_id, client_email, or private_key');
        return false;
      }
      return this.initWithCert(projectId, clientEmail, privateKey);
    } catch (e) {
      this.logger.warn(`FIREBASE_SERVICE_ACCOUNT_JSON parse failed: ${(e as Error).message}`);
      return false;
    }
  }

  private initFromApplicationDefault(fallbackProjectId?: string): boolean {
    try {
      if (getApps().length === 0) {
        this.app = initializeApp({
          credential: applicationDefault(),
          projectId: fallbackProjectId || undefined,
        });
      } else {
        this.app = getApps()[0]!;
      }
      this.messaging = getMessaging(this.app);
      this.logger.log('Firebase Admin SDK initialized (application default / WIF)');
      return true;
    } catch (e) {
      this.logger.warn(`Firebase ADC init failed: ${(e as Error).message}`);
      return false;
    }
  }

  private initWithCert(projectId: string, clientEmail: string, privateKey: string): boolean {
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
      return true;
    } catch (e) {
      this.logger.warn(`Firebase Admin init failed: ${(e as Error).message}`);
      return false;
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
