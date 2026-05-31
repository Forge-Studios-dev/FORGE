import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { AppCheckGuard } from './app-check.guard';

@Global()
@Module({
  providers: [FirebaseService, AppCheckGuard],
  exports: [FirebaseService, AppCheckGuard],
})
export class FirebaseModule {}
