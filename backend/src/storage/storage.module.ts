import { Global, Module } from '@nestjs/common';
import { LocalDiskStorage, MinioStorage, STORAGE } from './storage';

@Global()
@Module({
  providers: [
    LocalDiskStorage,
    MinioStorage,
    {
      provide: STORAGE,
      useFactory: (local: LocalDiskStorage, minio: MinioStorage) => (process.env.STORAGE_BACKEND === 'minio' ? minio : local),
      inject: [LocalDiskStorage, MinioStorage],
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
